import {
  WORKER_PROTOCOL_VERSION,
  type ModelArtifact,
  type ProgressEvent,
  type RecognitionInput,
  type FormulaWorkerInput,
  type WorkerError,
  type WorkerFactory,
  type WorkerInitOptions,
  type WorkerLike,
  type WorkerRequest,
  type WorkerResponse,
} from "./types.js";
import { validateWorkerRequest } from "./worker-request-validation.js";
import { MAX_COMPLETION_ENVELOPE_BYTES, type FormulaCompletionRequest, type FormulaCompletionApplyRequest, type FormulaCompletionReply, type AppliedFormulaCompletion } from "./completion.js";
import type { ApiEnvelopeV3 } from "./types.js";
import type { ScopedFormulaCompletionRequest, ScopedFormulaCompletionApplyRequest, ScopedFormulaCompletion } from "./completion.js";
import type { FormulaFragmentCompletionRequest, FormulaFragmentCompletionApplyRequest, FormulaFragmentCompletion } from "./completion.js";
import { WorkerFormulaRegistry, type RegistryWorkerCommand } from "./worker-registry.js";
import { WorkerFormulaPreferences } from "./worker-preferences.js";
import type { FormulaPreferenceConfiguration, FormulaPreferenceRestoreConfiguration } from "./preferences.js";

interface PendingCall {
  resolve(value: unknown): void;
  reject(error: WorkerRuntimeError): void;
}

type CompletionTaskRequest = Extract<WorkerRequest, { type: "complete-formula" | "apply-formula-completion" | "complete-formula-scoped" | "apply-formula-completion-scoped" | "complete-formula-fragments" | "apply-formula-completion-fragments" }>;

interface WorkerTask extends PendingCall {
  requestId: string;
  wireRequestId: string;
  request: Extract<WorkerRequest, { type: "recognize" | "convert-formula" | "formula-registry-create" | "formula-registry-command" | "formula-preferences-create" | "formula-preferences-restore" | "formula-preferences-command" }> | CompletionTaskRequest;
  durationMillis: number;
  resultBytes: number;
  onProgress?: (event: ProgressEvent) => void;
  generation: number;
  timeout?: ReturnType<typeof setTimeout>;
}

export class WorkerRuntimeError extends Error {
  constructor(public readonly detail: WorkerError) {
    super(detail.message);
    this.name = "WorkerRuntimeError";
  }
}

export interface WasmWorkerClientOptions extends WorkerInitOptions {
  workerUrl: string | URL;
  workerFactory?: WorkerFactory;
  maxQueueLength?: number;
  rpcTimeoutMillis?: number;
  maxTaskDurationMillis?: number;
  maxModelBytes?: number;
  maxTotalModelBytes?: number;
  maxImageWidth?: number;
  maxImageHeight?: number;
  maxImagePixels?: number;
  maxResultBytes?: number;
  maxFormulaInputBytes?: number;
  maxFormulaResultBytes?: number;
  maxFormulaDurationMillis?: number;
  maxCompletionResultBytes?: number;
}

export interface WorkerCallOptions {
  timeoutMillis?: number;
  signal?: AbortSignal;
}

export class WasmWorkerClient {
  private worker!: WorkerLike;
  private readonly calls = new Map<string, PendingCall>();
  private readonly models = new Map<string, ModelArtifact>();
  private readonly queue: WorkerTask[] = [];
  private active?: WorkerTask;
  private generation = 0;
  private sequence = 0;
  private initialized: Promise<void>;
  private terminated = false;
  private readonly maxQueueLength: number;
  private readonly rpcTimeoutMillis: number;
  private readonly maxTaskDurationMillis: number;
  private readonly maxModelBytes: number;
  private readonly maxTotalModelBytes: number;
  private readonly maxImageWidth: number;
  private readonly maxImageHeight: number;
  private readonly maxImagePixels: number;
  private readonly maxResultBytes: number;
  private readonly maxFormulaInputBytes: number;
  private readonly maxFormulaResultBytes: number;
  private readonly maxFormulaDurationMillis: number;
  private readonly maxCompletionResultBytes: number;
  private restarting?: Promise<void>;

  constructor(private readonly options: WasmWorkerClientOptions) {
    this.maxQueueLength = options.maxQueueLength ?? 32;
    this.rpcTimeoutMillis = options.rpcTimeoutMillis ?? 30_000;
    this.maxTaskDurationMillis = options.maxTaskDurationMillis ?? 120_000;
    this.maxModelBytes = options.maxModelBytes ?? 128 * 1024 * 1024;
    this.maxTotalModelBytes = options.maxTotalModelBytes ?? 256 * 1024 * 1024;
    this.maxImageWidth = options.maxImageWidth ?? 8_192;
    this.maxImageHeight = options.maxImageHeight ?? 8_192;
    this.maxImagePixels = options.maxImagePixels ?? 40_000_000;
    this.maxResultBytes = options.maxResultBytes ?? 16 * 1024 * 1024;
    this.maxFormulaInputBytes = options.maxFormulaInputBytes ?? 64 * 1024;
    this.maxFormulaResultBytes = options.maxFormulaResultBytes ?? 256 * 1024;
    this.maxFormulaDurationMillis = options.maxFormulaDurationMillis ?? 30_000;
    this.maxCompletionResultBytes = options.maxCompletionResultBytes ?? MAX_COMPLETION_ENVELOPE_BYTES;
    positiveInteger("maxQueueLength", this.maxQueueLength);
    positiveInteger("rpcTimeoutMillis", this.rpcTimeoutMillis);
    positiveInteger("maxTaskDurationMillis", this.maxTaskDurationMillis);
    positiveInteger("maxModelBytes", this.maxModelBytes);
    positiveInteger("maxTotalModelBytes", this.maxTotalModelBytes);
    positiveInteger("maxImageWidth", this.maxImageWidth);
    positiveInteger("maxImageHeight", this.maxImageHeight);
    positiveInteger("maxImagePixels", this.maxImagePixels);
    positiveInteger("maxResultBytes", this.maxResultBytes);
    positiveInteger("maxFormulaInputBytes", this.maxFormulaInputBytes);
    positiveInteger("maxFormulaResultBytes", this.maxFormulaResultBytes);
    positiveInteger("maxFormulaDurationMillis", this.maxFormulaDurationMillis);
    positiveInteger("maxCompletionResultBytes", this.maxCompletionResultBytes);
    if (this.maxCompletionResultBytes > MAX_COMPLETION_ENVELOPE_BYTES) throw new RangeError("maxCompletionResultBytes exceeds the worker limit");
    if (this.maxFormulaInputBytes > 64 * 1024) throw new RangeError("maxFormulaInputBytes must not exceed Core's 64 KiB limit");
    if (this.maxFormulaResultBytes > 256 * 1024) throw new RangeError("maxFormulaResultBytes must not exceed the worker's 256 KiB envelope limit");
    if (this.maxModelBytes > this.maxTotalModelBytes) {
      throw new RangeError("maxModelBytes must not exceed maxTotalModelBytes");
    }
    this.initialized = this.startWorker();
  }

  ready(): Promise<void> {
    return this.initialized;
  }

  async loadModel(artifact: ModelArtifact, callOptions: WorkerCallOptions = {}): Promise<unknown> {
    if (artifact.bytes.byteLength > this.maxModelBytes) {
      throw this.runtimeError("MODEL_ARTIFACT_LIMIT", "Model artifact exceeds the configured byte limit");
    }
    const currentBytes = this.models.get(artifact.name)?.bytes.byteLength ?? 0;
    const projectedBytes = this.loadedModelBytes() - currentBytes + artifact.bytes.byteLength;
    if (projectedBytes > this.maxTotalModelBytes) {
      throw this.runtimeError("MODEL_TOTAL_LIMIT", "Loaded models would exceed the configured total byte limit");
    }
    await this.initialized;
    const owned = { ...artifact, bytes: artifact.bytes.slice() };
    const result = await this.call({
      protocolVersion: WORKER_PROTOCOL_VERSION,
      type: "load-model",
      requestId: this.nextId("model"),
      artifact: owned,
    }, callOptions);
    this.models.set(owned.name, owned);
    return result;
  }

  recognize(input: RecognitionInput, onProgress?: (event: ProgressEvent) => void): Promise<unknown> {
    if (this.terminated) return Promise.reject(this.runtimeError("WORKER_TERMINATED", "Worker client is terminated"));
    const inputError = this.validateRecognitionInput(input);
    if (inputError) return Promise.reject(inputError);
    const requestId = input.requestId ?? this.nextId("recognize");
    if (this.hasRequest(requestId)) {
      return Promise.reject(this.runtimeError("DUPLICATE_REQUEST_ID", `Request '${requestId}' already exists`));
    }
    if (this.queue.length >= this.maxQueueLength) {
      return Promise.reject(this.runtimeError("WORKER_QUEUE_FULL", "Recognition queue is full"));
    }
    return new Promise((resolve, reject) => {
      const wireRequestId = this.nextId("recognize");
      this.queue.push({
        requestId,
        wireRequestId,
        request: { protocolVersion: WORKER_PROTOCOL_VERSION, type: "recognize", requestId: wireRequestId, input: { width: input.width, height: input.height, pixels: input.pixels.slice(), mode: input.mode } },
        durationMillis: this.maxTaskDurationMillis,
        resultBytes: this.maxResultBytes,
        onProgress,
        resolve,
        reject,
        generation: this.generation,
      });
      void this.pump();
    });
  }

  /** Model-free conversion shares the bounded execution queue, not inference state. */
  convertFormula(input: FormulaWorkerInput, callOptions: WorkerCallOptions = {}): Promise<unknown> {
    const signal = callOptions.signal;
    if (this.terminated) return Promise.reject(this.runtimeError("WORKER_TERMINATED", "Worker client is terminated"));
    if (signal?.aborted) return Promise.reject(this.runtimeError("CANCELLED", "Formula request was aborted"));
    const requestId = input.requestId ?? this.nextId("formula");
    const wireRequestId = this.nextId("formula");
    const request: Extract<WorkerRequest, { type: "convert-formula" }> = {
      protocolVersion: WORKER_PROTOCOL_VERSION, type: "convert-formula", requestId: wireRequestId,
      input: { content: input.content, inputFormat: input.inputFormat, outputFormat: input.outputFormat, mode: input.mode },
    };
    const validation = validateWorkerRequest({ ...request, requestId });
    if (!validation.ok) return Promise.reject(this.runtimeError(validation.code, validation.message));
    if (new TextEncoder().encode(input.content).byteLength > this.maxFormulaInputBytes) {
      return Promise.reject(this.runtimeError("WORKER_FORMULA_INPUT_LIMIT", "Formula exceeds the configured UTF-8 input budget"));
    }
    const durationMillis = callOptions.timeoutMillis ?? this.maxFormulaDurationMillis;
    if (!Number.isSafeInteger(durationMillis) || durationMillis <= 0) return Promise.reject(this.runtimeError("WORKER_RPC_INVALID_TIMEOUT", "Formula timeout must be a positive safe integer"));
    if (this.hasRequest(requestId)) return Promise.reject(this.runtimeError("DUPLICATE_REQUEST_ID", `Request '${requestId}' already exists`));
    if (this.queue.length >= this.maxQueueLength) return Promise.reject(this.runtimeError("WORKER_QUEUE_FULL", "Worker task queue is full"));
    return new Promise((resolve, reject) => {
      const abort = (): void => { this.cancel(requestId); };
      const cleanup = (): void => { signal?.removeEventListener("abort", abort); };
      this.queue.push({
        requestId, wireRequestId, request, durationMillis, resultBytes: this.maxFormulaResultBytes,
        generation: this.generation,
        resolve: (value) => { cleanup(); resolve(value); },
        reject: (error) => { cleanup(); reject(error); },
      });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      void this.pump();
    });
  }

  completeFormula(input: FormulaCompletionRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<FormulaCompletionReply>> {
    return this.completionTask("complete-formula", input, options) as Promise<ApiEnvelopeV3<FormulaCompletionReply>>;
  }

  applyFormulaCompletion(input: FormulaCompletionApplyRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<AppliedFormulaCompletion>> {
    return this.completionTask("apply-formula-completion", input, options) as Promise<ApiEnvelopeV3<AppliedFormulaCompletion>>;
  }

  completeFormulaScoped(input: ScopedFormulaCompletionRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<ScopedFormulaCompletion>> {
    return this.completionTask("complete-formula-scoped", input, options) as Promise<ApiEnvelopeV3<ScopedFormulaCompletion>>;
  }

  applyFormulaCompletionScoped(input: ScopedFormulaCompletionApplyRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<AppliedFormulaCompletion>> {
    return this.completionTask("apply-formula-completion-scoped", input, options) as Promise<ApiEnvelopeV3<AppliedFormulaCompletion>>;
  }

  completeFormulaFragments(input: FormulaFragmentCompletionRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<FormulaFragmentCompletion>> {
    return this.completionTask("complete-formula-fragments", input, options) as Promise<ApiEnvelopeV3<FormulaFragmentCompletion>>;
  }

  applyFormulaCompletionFragments(input: FormulaFragmentCompletionApplyRequest & { requestId?: string }, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<AppliedFormulaCompletion>> {
    return this.completionTask("apply-formula-completion-fragments", input, options) as Promise<ApiEnvelopeV3<AppliedFormulaCompletion>>;
  }

  private completionTask(type: CompletionTaskRequest["type"], input: (FormulaCompletionRequest | FormulaCompletionApplyRequest | ScopedFormulaCompletionRequest | ScopedFormulaCompletionApplyRequest | FormulaFragmentCompletionRequest | FormulaFragmentCompletionApplyRequest) & { requestId?: string }, options: WorkerCallOptions): Promise<unknown> {
    if (this.terminated) return Promise.reject(this.runtimeError("WORKER_TERMINATED", "Worker client is terminated"));
    if (options.signal?.aborted) return Promise.reject(this.runtimeError("CANCELLED", "Completion was aborted"));
    const { requestId: suppliedId, ...parameters } = input;
    const requestId = suppliedId ?? this.nextId("completion");
    const wireRequestId = this.nextId("completion");
    const request = { protocolVersion: WORKER_PROTOCOL_VERSION, type, requestId: wireRequestId, input: parameters };
    const validation = validateWorkerRequest({ ...request, requestId });
    if (!validation.ok) return Promise.reject(this.runtimeError(validation.code, validation.message));
    if (new TextEncoder().encode(input.source).byteLength > this.maxFormulaInputBytes) return Promise.reject(this.runtimeError("WORKER_FORMULA_INPUT_LIMIT", "Completion source exceeds the configured budget"));
    const durationMillis = options.timeoutMillis ?? this.maxFormulaDurationMillis;
    if (!Number.isSafeInteger(durationMillis) || durationMillis <= 0) return Promise.reject(this.runtimeError("WORKER_RPC_INVALID_TIMEOUT", "Completion duration must be a positive safe integer"));
    if (this.hasRequest(requestId)) return Promise.reject(this.runtimeError("DUPLICATE_REQUEST_ID", "Duplicate completion request ID"));
    if (this.queue.length >= this.maxQueueLength) return Promise.reject(this.runtimeError("WORKER_QUEUE_FULL", "Worker task queue is full"));
    const owned = structuredClone(request) as CompletionTaskRequest;
    return new Promise((resolve, reject) => {
      const abort = (): void => { this.cancel(requestId); };
      const cleanup = (): void => { options.signal?.removeEventListener("abort", abort); };
      this.queue.push({ requestId, wireRequestId, request: owned, durationMillis, resultBytes: this.maxCompletionResultBytes,
        generation: this.generation, resolve: (value) => { cleanup(); resolve(value); }, reject: (value) => { cleanup(); reject(value); } });
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      void this.pump();
    });
  }

  /** Uses only an explicitly loaded app-owned factory, never a request-supplied URL. */
  async createFormulaRegistry(configurationKey?: string, callOptions: WorkerCallOptions = {}): Promise<WorkerFormulaRegistry> {
    const generation = this.generation;
    const created = await this.registryTask({ protocolVersion: 1, type: "formula-registry-create",
      requestId: this.nextId("registry"), configurationKey }, generation, callOptions);
    if (generation !== this.generation || typeof created !== "object" || created === null ||
        typeof (created as { registryId?: unknown }).registryId !== "string" ||
        !/^registry:[1-9][0-9]{0,15}$/.test((created as { registryId: string }).registryId)) {
      throw this.runtimeError("WORKER_REGISTRY_STALE", "Registry creation did not produce a current handle");
    }
    const registryId = (created as { registryId: string }).registryId;
    return new WorkerFormulaRegistry((command, options) => this.registryTask({ protocolVersion: 1,
      type: "formula-registry-command", requestId: this.nextId("registry"), registryId, command }, generation, options));
  }

  /** Opt-in memory only. The caller retains consent, fresh keys and edit/undo ownership. */
  async createFormulaPreferences(configuration: FormulaPreferenceConfiguration, options: WorkerCallOptions = {}): Promise<WorkerFormulaPreferences> {
    const generation = this.generation;
    const created = await this.registryTask({ protocolVersion: 1, type: "formula-preferences-create",
      requestId: this.nextId("preferences"), configuration }, generation, options);
    return this.preferenceOwner(created, generation);
  }

  /** Explicit trusted-host restore, never automatic on restart or failed response. */
  async restoreFormulaPreferences(configuration: FormulaPreferenceRestoreConfiguration, options: WorkerCallOptions = {}): Promise<WorkerFormulaPreferences> {
    const generation = this.generation;
    const created = await this.registryTask({ protocolVersion: 1, type: "formula-preferences-restore",
      requestId: this.nextId("preferences"), configuration }, generation, options);
    return this.preferenceOwner(created, generation);
  }

  private preferenceOwner(created: unknown, generation: number): WorkerFormulaPreferences {
    if (generation !== this.generation || typeof created !== "object" || created === null ||
        typeof (created as { ownerId?: unknown }).ownerId !== "string" ||
        !/^preferences:[1-9][0-9]{0,15}$/.test((created as { ownerId: string }).ownerId)) {
      if (generation === this.generation) this.restartWorker("WORKER_PREFERENCES_STALE", "Invalid preference creation result; unknown state discarded");
      throw this.runtimeError("WORKER_PREFERENCES_STALE", "Preference creation did not produce a current handle");
    }
    const ownerId = (created as { ownerId: string }).ownerId;
    return new WorkerFormulaPreferences((command, options) => this.registryTask({ protocolVersion: 1,
      type: "formula-preferences-command", requestId: this.nextId("preferences"), ownerId, command }, generation, options));
  }

  private registryTask(request: Extract<WorkerRequest, { type: "formula-registry-create" | "formula-registry-command" | "formula-preferences-create" | "formula-preferences-restore" | "formula-preferences-command" }>,
    generation: number, options: WorkerCallOptions): Promise<unknown> {
    const preferences = request.type.startsWith("formula-preferences-");
    if (this.terminated) return Promise.reject(this.runtimeError("WORKER_TERMINATED", "Worker client is terminated"));
    if (generation !== this.generation) return Promise.reject(this.runtimeError(preferences ? "WORKER_PREFERENCES_STALE" : "WORKER_REGISTRY_STALE", "Owned state was invalidated by a worker restart"));
    if (options.signal?.aborted) return Promise.reject(this.runtimeError("CANCELLED", "Registry request was aborted"));
    const validation = validateWorkerRequest(request);
    if (!validation.ok) return Promise.reject(this.runtimeError(validation.code, validation.message));
    if (this.queue.length >= this.maxQueueLength) return Promise.reject(this.runtimeError("WORKER_QUEUE_FULL", "Worker task queue is full"));
    const durationMillis = options.timeoutMillis ?? this.maxFormulaDurationMillis;
    if (!Number.isSafeInteger(durationMillis) || durationMillis <= 0) return Promise.reject(this.runtimeError("WORKER_RPC_INVALID_TIMEOUT", "Invalid registry duration"));
    const owned = structuredClone(request);
    return new Promise((resolve, reject) => {
      const abort = (): void => { this.cancel(owned.requestId); };
      const cleanup = (): void => { options.signal?.removeEventListener("abort", abort); };
      this.queue.push({ requestId: owned.requestId, wireRequestId: owned.requestId, request: owned,
        generation, durationMillis, resultBytes: preferences ? (request.type === "formula-preferences-create" || request.type === "formula-preferences-restore" ? 4096 : this.maxCompletionResultBytes) : 2 * 1024 * 1024 + 64 * 1024,
        resolve: (value) => { cleanup(); resolve(value); }, reject: (error) => { cleanup(); reject(error); } });
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      void this.pump();
    });
  }

  cancel(requestId: string): boolean {
    if (this.active?.requestId === requestId) {
      this.restartWorker(
        "WORKER_RESTARTED",
        "Worker restarted after hard cancellation",
        this.runtimeError("CANCELLED", `Request '${requestId}' was cancelled`, {
          hardCancellation: true,
          workerRestarted: true,
        }),
      );
      return true;
    }
    const index = this.queue.findIndex((task) => task.requestId === requestId);
    if (index < 0) return false;
    const [cancelled] = this.queue.splice(index, 1);
    cancelled?.reject(this.runtimeError("CANCELLED", `Queued request '${requestId}' was cancelled`, {
      hardCancellation: false,
      workerRestarted: false,
    }));
    return true;
  }

  terminate(): void {
    if (this.terminated) return;
    this.terminated = true;
    this.worker.terminate();
    if (this.active?.timeout) clearTimeout(this.active.timeout);
    this.active?.reject(this.runtimeError("WORKER_TERMINATED", "Worker client terminated"));
    this.active = undefined;
    for (const task of this.queue.splice(0)) task.reject(this.runtimeError("WORKER_TERMINATED", "Worker client terminated"));
    this.rejectAllCalls("WORKER_TERMINATED", "Worker client terminated");
  }

  private async startWorker(): Promise<void> {
    if (this.terminated) throw this.runtimeError("WORKER_TERMINATED", "Worker client is terminated");
    const worker = this.options.workerFactory?.() ?? new Worker(this.options.workerUrl, { type: "module" });
    this.worker = worker;
    const workerGeneration = this.generation;
    worker.onmessage = (event) => this.onMessage(event.data, workerGeneration);
    worker.onerror = (event) => this.onWorkerError(event.message || "Worker failed", workerGeneration);
    worker.onmessageerror = () => this.onWorkerError("Worker message deserialization failed", workerGeneration);
    await this.call({
      protocolVersion: WORKER_PROTOCOL_VERSION,
      type: "initialize",
      requestId: this.nextId("init"),
      options: { moduleUrl: this.options.moduleUrl, wasmUrl: this.options.wasmUrl },
    });
  }

  private async reloadModels(): Promise<void> {
    for (const artifact of this.models.values()) {
      await this.call({
        protocolVersion: WORKER_PROTOCOL_VERSION,
        type: "load-model",
        requestId: this.nextId("reload"),
        artifact: { ...artifact, bytes: artifact.bytes.slice() },
      });
    }
  }

  private async pump(): Promise<void> {
    const generation = this.generation;
    try {
      await this.initialized;
    } catch {
      return;
    }
    // A restart may have replaced the resolved promise while this pump was
    // suspended. Recovery owns the next pump after the new worker is ready.
    if (generation !== this.generation || this.active || this.terminated) return;
    const task = this.queue.shift();
    if (!task) return;
    task.generation = this.generation;
    this.active = task;
    try {
      this.worker.postMessage(task.request);
      task.timeout = setTimeout(() => {
        if (this.active !== task) return;
        this.restartWorker(
          "WORKER_TASK_TIMEOUT",
          `Worker task exceeded ${task.durationMillis} ms`,
          this.runtimeError("WORKER_TASK_TIMEOUT", "Worker task exceeded the configured duration limit", {
            workerRestarted: true,
          }),
        );
      }, task.durationMillis);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      this.restartWorker(
        "WORKER_POST_MESSAGE_FAILED",
        message,
        this.runtimeError("WORKER_POST_MESSAGE_FAILED", message, { workerRestarted: true }),
      );
    }
  }

  private onMessage(response: WorkerResponse, workerGeneration: number): void {
    if (workerGeneration !== this.generation) return;
    if (response.protocolVersion !== WORKER_PROTOCOL_VERSION) {
      this.restartWorker(
        "WORKER_PROTOCOL_MISMATCH",
        "Worker returned an unsupported protocol version",
      );
      return;
    }
    if (response.type === "progress") {
      if (this.active?.wireRequestId === response.requestId) {
        this.active.onProgress?.({ requestId: this.active.requestId, stage: response.stage, progress: response.progress });
      }
      return;
    }
    const call = this.calls.get(response.requestId);
    if (call) {
      this.calls.delete(response.requestId);
      response.type === "result" ? call.resolve(response.data) : call.reject(new WorkerRuntimeError(response.error));
      return;
    }
    if (this.active?.wireRequestId !== response.requestId) {
      this.restartWorker("WORKER_PROTOCOL_CORRUPTION", `Worker returned unknown response ID '${response.requestId}'`);
      return;
    }
    const task = this.active;
    this.active = undefined;
    if (task.timeout) clearTimeout(task.timeout);
    if (response.type === "result" && serializedBytes(response.data) > task.resultBytes) {
      const preferences = task.request.type.startsWith("formula-preferences-");
      task.reject(this.runtimeError("WORKER_RESULT_LIMIT", "Worker result exceeds the configured byte limit", { workerRestarted: preferences }));
      if (preferences) {
        // A lost creation/capture/receipt response must not leave unknown state
        // reusable by a later command. Never replay the interrupted feedback.
        this.restartWorker("WORKER_PREFERENCES_STALE", "Preference result was lost; owned state discarded");
        return;
      }
    } else {
      response.type === "result" ? task.resolve(response.data) : task.reject(new WorkerRuntimeError(response.error));
    }
    void this.pump();
  }

  private onWorkerError(message: string, workerGeneration: number): void {
    if (workerGeneration !== this.generation || this.terminated) return;
    this.restartWorker("WORKER_CRASHED", message, this.runtimeError("WORKER_CRASHED", message, {
      workerRestarted: true,
    }));
  }

  private call(request: WorkerRequest, options: WorkerCallOptions = {}): Promise<unknown> {
    if (options.signal?.aborted) {
      return Promise.reject(this.runtimeError("WORKER_RPC_ABORTED", `Worker RPC '${request.type}' was aborted`));
    }
    const timeoutMillis = options.timeoutMillis ?? this.rpcTimeoutMillis;
    if (!Number.isFinite(timeoutMillis) || timeoutMillis <= 0) {
      return Promise.reject(this.runtimeError("WORKER_RPC_INVALID_TIMEOUT", "Worker RPC timeout must be positive"));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      };
      const pending: PendingCall = {
        resolve: (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        },
      };
      const failAndRestart = (code: string, message: string): void => {
        if (!this.calls.delete(request.requestId)) return;
        pending.reject(this.runtimeError(code, message, { workerRestarted: true }));
        this.restartWorker(code, message);
      };
      const timer = setTimeout(() => {
        failAndRestart("WORKER_RPC_TIMEOUT", `Worker RPC '${request.type}' exceeded ${timeoutMillis} ms`);
      }, timeoutMillis);
      const abort = (): void => {
        failAndRestart("WORKER_RPC_ABORTED", `Worker RPC '${request.type}' was aborted`);
      };
      options.signal?.addEventListener("abort", abort, { once: true });
      this.calls.set(request.requestId, pending);
      try {
        this.worker.postMessage(request);
      } catch (cause) {
        failAndRestart(
          "WORKER_POST_MESSAGE_FAILED",
          cause instanceof Error ? cause.message : String(cause),
        );
      }
    });
  }

  private restartWorker(code: string, message: string, activeError?: WorkerRuntimeError): void {
    if (this.terminated) return;
    const active = this.active;
    this.active = undefined;
    if (active?.timeout) clearTimeout(active.timeout);
    this.generation += 1;
    // Registry instances and queued commands cannot be recreated/replayed after
    // termination. Existing pure legacy tasks retain their recovery behavior.
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index]!.request.type.startsWith("formula-preferences-")) {
        this.queue.splice(index, 1)[0]!.reject(this.runtimeError("WORKER_PREFERENCES_STALE", "Worker restart invalidated preference state", { workerRestarted: true }));
      } else if (this.queue[index]!.request.type.startsWith("formula-registry-")) {
        this.queue.splice(index, 1)[0]!.reject(this.runtimeError("WORKER_REGISTRY_STALE", "Worker restart invalidated the registry", { workerRestarted: true }));
      }
    }
    this.worker.terminate();
    this.rejectAllCalls(code, message);
    active?.reject(activeError ?? this.runtimeError(code, message, { workerRestarted: true }));

    if (this.restarting) {
      this.rejectQueue("WORKER_RECOVERY_FAILED", "Worker failed again during recovery");
      return;
    }
    const recovery = this.startWorker().then(() => this.reloadModels());
    this.restarting = recovery;
    this.initialized = recovery;
    void recovery
      .then(() => this.pump())
      .catch((cause: unknown) => {
        this.rejectQueue(
          "WORKER_RECOVERY_FAILED",
          cause instanceof Error ? cause.message : String(cause),
        );
      })
      .finally(() => {
        if (this.restarting === recovery) this.restarting = undefined;
      });
  }

  private rejectAllCalls(code: string, message: string): void {
    for (const call of this.calls.values()) call.reject(this.runtimeError(code, message));
    this.calls.clear();
  }

  private rejectQueue(code: string, message: string): void {
    for (const task of this.queue.splice(0)) task.reject(this.runtimeError(code, message));
  }

  private hasRequest(requestId: string): boolean {
    return this.active?.requestId === requestId || this.queue.some((task) => task.requestId === requestId);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `internal:${prefix}:${this.sequence}`;
  }

  private loadedModelBytes(): number {
    let total = 0;
    for (const artifact of this.models.values()) total += artifact.bytes.byteLength;
    return total;
  }

  private validateRecognitionInput(input: RecognitionInput): WorkerRuntimeError | undefined {
    for (const [name, value] of [["width", input.width], ["height", input.height]] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        return this.runtimeError("WORKER_INVALID_IMAGE", `${name} must be a positive safe integer`);
      }
    }
    if (input.width > this.maxImageWidth || input.height > this.maxImageHeight) {
      return this.runtimeError("WORKER_IMAGE_LIMIT", "Image dimensions exceed the configured limit");
    }
    const pixels = input.width * input.height;
    if (!Number.isSafeInteger(pixels) || pixels > this.maxImagePixels) {
      return this.runtimeError("WORKER_IMAGE_LIMIT", "Image pixels exceed the configured limit");
    }
    if (input.pixels.byteLength !== pixels * 4) {
      return this.runtimeError("WORKER_INVALID_IMAGE", "RGBA pixel length does not match image dimensions");
    }
    return undefined;
  }

  private runtimeError(code: string, message: string, extra: Partial<WorkerError> = {}): WorkerRuntimeError {
    return new WorkerRuntimeError({ code, message, recoverable: true, ...extra });
  }
}

function positiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function serializedBytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 0 : new TextEncoder().encode(serialized).byteLength;
}

export function warnIfMainThreadInference(): void {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    console.warn("LaTeXSnipper: heavy WASM inference on the main thread can block the UI; use WasmWorkerClient.");
  }
}
