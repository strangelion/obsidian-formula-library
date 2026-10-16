import {
  WORKER_PROTOCOL_VERSION,
  type WorkerRequest,
  type WorkerResponse,
} from "./types.js";
import { validateWorkerRequest } from "./worker-request-validation.js";
import type { WasmFormulaApi, WasmFormulaFragmentApi } from "./formula.js";
import { MAX_COMPLETION_ENVELOPE_BYTES, type WasmFormulaCompletionApi, type WasmScopedFormulaCompletionApi, type WasmFragmentFormulaCompletionApi } from "./completion.js";
import { registryJson, type NativeFormulaRegistry, type WasmFormulaRegistryApi } from "./registry.js";
import { preferenceJson, preferenceCommandBudget, type NativeFormulaPreferences, type WasmFormulaPreferenceApi, type WasmFormulaPreferenceRestoreApi } from "./preferences.js";

interface WasmApi {
  create_formula_preferences_v1?: WasmFormulaPreferenceApi["create_formula_preferences_v1"];
  restore_formula_preferences_v1?: WasmFormulaPreferenceRestoreApi["restore_formula_preferences_v1"];
  complete_formula_fragments_v3?: WasmFragmentFormulaCompletionApi["complete_formula_fragments_v3"];
  apply_formula_completion_fragments_v3?: WasmFragmentFormulaCompletionApi["apply_formula_completion_fragments_v3"];
  complete_formula_scoped_v3?: WasmScopedFormulaCompletionApi["complete_formula_scoped_v3"];
  apply_formula_completion_scoped_v3?: WasmScopedFormulaCompletionApi["apply_formula_completion_scoped_v3"];
  complete_formula_v3?: WasmFormulaCompletionApi["complete_formula_v3"];
  apply_formula_completion_v3?: WasmFormulaCompletionApi["apply_formula_completion_v3"];
  create_formula_registry_v1?: WasmFormulaRegistryApi["create_formula_registry_v1"];
  convert_formula_v3?: WasmFormulaApi["convert_formula_v3"];
  convert_formula_fragment_v3?: WasmFormulaFragmentApi["convert_formula_fragment_v3"];
  default?: (wasmUrl?: string) => Promise<unknown>;
  init?: () => void;
  load_model_v2?(name: string, bytes: Uint8Array, expectedSha256?: string): unknown;
  clear_models_v2?(): unknown;
  cancel_recognition_v2?(): unknown;
  recognize_v2_with_progress?(
    width: number,
    height: number,
    pixels: Uint8Array,
    mode: string,
    progress: (event: { stage: string; progress: number }) => void,
  ): Promise<unknown>;
}

type WorkerScope = typeof globalThis & {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
};

const scope = globalThis as WorkerScope;
let api: WasmApi | undefined;
let queue = Promise.resolve();
const registries = new Map<string, NativeFormulaRegistry>();
let registrySequence = 0;
const preferences = new Map<string, NativeFormulaPreferences>();
let preferenceSequence = 0;

// Preserve actionable Core codes, never echo a factory's private message/data.
const RESTORE_FAILURE_CODES = new Set(["PREFERENCE_STORAGE_DISABLED", "INVALID_ARGUMENT", "INVALID_SNAPSHOT",
  "AUTHENTICATION_FAILED", "SCOPE_MISMATCH", "STALE_CHECKPOINT", "SENSITIVE_STORAGE_DENIED", "LIMIT_EXCEEDED",
  "PREFERENCE_UNAVAILABLE", "VERSION_MISMATCH", "INVALID_JSON", "INPUT_TOO_LARGE"]);
function restoreFailureCode(cause: unknown): string {
  try {
    if (typeof cause === "object" && cause !== null && (cause as { ok?: unknown }).ok === false) {
      const value = (cause as { error?: { code?: unknown } }).error?.code;
      if (typeof value === "string" && RESTORE_FAILURE_CODES.has(value)) return value;
    }
  } catch { /* Untrusted thrown getters must not escape the redacted boundary. */ }
  return "WORKER_PREFERENCES_RESTORE_FAILED";
}

function respond(message: WorkerResponse): void {
  scope.postMessage(message);
}

function error(requestId: string, code: string, message: string, details?: unknown): void {
  respond({
    protocolVersion: WORKER_PROTOCOL_VERSION,
    type: "error",
    requestId,
    error: { code, message, recoverable: true, details },
  });
}

async function handle(request: WorkerRequest): Promise<void> {
  try {
    if (request.protocolVersion !== WORKER_PROTOCOL_VERSION) {
      error(request.requestId, "WORKER_PROTOCOL_MISMATCH", "Unsupported worker protocol version");
      return;
    }
    if (request.type === "initialize") {
      api = undefined;
      const previous = [...registries.values(), ...preferences.values()];
      registries.clear();
      preferences.clear();
      let cleanupFailed = false;
      for (const registry of previous) {
        try { try { registry.close(); } finally { registry.free(); } }
        catch { cleanupFailed = true; }
      }
      if (cleanupFailed) throw new Error("Previous registry cleanup failed; worker must be restarted");
      const loaded = (await import(request.options.moduleUrl)) as WasmApi;
      if (loaded.default) await loaded.default(request.options.wasmUrl);
      loaded.init?.();
      api = loaded;
      respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data: true });
      return;
    }
    if (!api) {
      error(request.requestId, "WORKER_NOT_INITIALIZED", "Initialize the worker before use");
      return;
    }
    if (request.type === "formula-preferences-create" || request.type === "formula-preferences-restore") {
      const restoring = request.type === "formula-preferences-restore";
      const factory = restoring ? api.restore_formula_preferences_v1 : api.create_formula_preferences_v1;
      if (!factory) { error(request.requestId, "WORKER_PREFERENCES_UNAVAILABLE", "Loaded package lacks the requested preference factory"); return; }
      if (preferences.size >= 64 || !Number.isSafeInteger(preferenceSequence + 1)) {
        error(request.requestId, "WORKER_PREFERENCES_LIMIT", "Preference owner or identifier limit reached"); return;
      }
      let owner: NativeFormulaPreferences;
      try { owner = factory.call(api, preferenceJson(request.configuration, restoring ? 1024 * 1024 : 4096)); }
      catch (cause) {
        error(request.requestId, restoring ? restoreFailureCode(cause) : "WORKER_PREFERENCES_CREATE_FAILED",
          restoring ? "Preference checkpoint restoration was refused" : "Preference creation was refused; check configuration and Web Crypto availability"); return;
      }
      const ownerId = `preferences:${++preferenceSequence}`;
      preferences.set(ownerId, owner);
      respond({ protocolVersion: 1, type: "result", requestId: request.requestId, data: { ownerId } }); return;
    }
    if (request.type === "formula-preferences-command") {
      const owner = preferences.get(request.ownerId);
      if (!owner) { error(request.requestId, "WORKER_PREFERENCES_STALE", "Preference owner is unknown or was lost on restart"); return; }
      const command = request.command;
      let data: unknown;
      if (command.kind === "close") {
        const closed = owner.close();
        if (closed.ok) { preferences.delete(request.ownerId); owner.free(); }
        data = closed;
      } else data = owner.command(preferenceJson(command, preferenceCommandBudget(command)));
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_COMPLETION_ENVELOPE_BYTES) {
        error(request.requestId, "WORKER_RESULT_LIMIT", "Preference envelope exceeds its result budget"); return;
      }
      respond({ protocolVersion: 1, type: "result", requestId: request.requestId, data }); return;
    }
    if (request.type === "formula-registry-create") {
      if (!api.create_formula_registry_v1) { error(request.requestId, "WORKER_REGISTRY_UNAVAILABLE", "Loaded package lacks a registry factory"); return; }
      if (registries.size >= 64) { error(request.requestId, "WORKER_REGISTRY_LIMIT", "At most 64 registries are allowed"); return; }
      if (!Number.isSafeInteger(registrySequence + 1)) { error(request.requestId, "WORKER_REGISTRY_LIMIT", "Registry identifier space exhausted"); return; }
      const registry = api.create_formula_registry_v1(request.configurationKey);
      const registryId = `registry:${++registrySequence}`;
      registries.set(registryId, registry);
      respond({ protocolVersion: 1, type: "result", requestId: request.requestId, data: { registryId } }); return;
    }
    if (request.type === "formula-registry-command") {
      const registry = registries.get(request.registryId);
      if (!registry) { error(request.requestId, "WORKER_REGISTRY_STALE", "Registry is unknown or was lost on restart"); return; }
      const command = request.command;
      let data: unknown;
      if (command.kind === "close") {
        registries.delete(request.registryId);
        try { data = registry.close(); } finally { registry.free(); }
      } else if (command.kind === "capabilities") data = registry.capabilities();
      else if (command.kind === "set-enabled") data = registry.set_enabled(command.backend, command.enabled);
      else data = registry.convert(registryJson(command.request), registryJson(command.policy, 4096));
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 2 * 1024 * 1024 + 64 * 1024) {
        error(request.requestId, "WORKER_RESULT_LIMIT", "Registry envelope exceeds its result budget"); return;
      }
      respond({ protocolVersion: 1, type: "result", requestId: request.requestId, data }); return;
    }
    if (request.type === "complete-formula" || request.type === "apply-formula-completion" ||
        request.type === "complete-formula-scoped" || request.type === "apply-formula-completion-scoped" ||
        request.type === "complete-formula-fragments" || request.type === "apply-formula-completion-fragments") {
      const operation = request.type === "complete-formula" ? api.complete_formula_v3
        : request.type === "apply-formula-completion" ? api.apply_formula_completion_v3
        : request.type === "complete-formula-scoped" ? api.complete_formula_scoped_v3
        : request.type === "apply-formula-completion-scoped" ? api.apply_formula_completion_scoped_v3
        : request.type === "complete-formula-fragments" ? api.complete_formula_fragments_v3 : api.apply_formula_completion_fragments_v3;
      if (!operation) { error(request.requestId, "WORKER_COMPLETION_UNAVAILABLE", "Loaded WASM package lacks the requested completion export"); return; }
      const data = operation(JSON.stringify(request.input));
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_COMPLETION_ENVELOPE_BYTES) {
        error(request.requestId, "WORKER_RESULT_LIMIT", "Completion envelope exceeds its worker result budget"); return;
      }
      respond({ protocolVersion: 1, type: "result", requestId: request.requestId, data }); return;
    }
    if (request.type === "convert-formula") {
      const input = request.input;
      const fragment = input.outputFormat === "latex-fragment";
      if (fragment ? !api.convert_formula_fragment_v3 : !api.convert_formula_v3) {
        error(request.requestId, "WORKER_FORMULA_UNAVAILABLE", "Loaded WASM package lacks the requested formula export");
        return;
      }
      const data = fragment
        ? api.convert_formula_fragment_v3!(input.content, input.inputFormat, input.mode ?? "strict")
        : api.convert_formula_v3!(input.content, input.inputFormat, input.outputFormat as Exclude<typeof input.outputFormat, "latex-fragment">, input.mode ?? "strict");
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 256 * 1024) {
        error(request.requestId, "WORKER_RESULT_LIMIT", "Formula envelope exceeds the 256 KiB worker result budget");
        return;
      }
      respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data });
      return;
    }
    if (request.type === "load-model") {
      if (!api.load_model_v2) {
        error(request.requestId, "WORKER_RECOGNITION_UNAVAILABLE", "Loaded package does not include recognition models");
        return;
      }
      const data = api.load_model_v2(
        request.artifact.name,
        request.artifact.bytes,
        request.artifact.expectedSha256,
      );
      respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data });
      return;
    }
    if (request.type === "clear-models") {
      if (!api.clear_models_v2) {
        error(request.requestId, "WORKER_RECOGNITION_UNAVAILABLE", "Loaded package does not include recognition models");
        return;
      }
      const data = api.clear_models_v2();
      respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data });
      return;
    }
    if (request.type === "cooperative-cancel") {
      if (!api.cancel_recognition_v2) {
        error(request.requestId, "WORKER_RECOGNITION_UNAVAILABLE", "Loaded package does not include recognition");
        return;
      }
      const data = api.cancel_recognition_v2();
      respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data });
      return;
    }
    if (!api.recognize_v2_with_progress) {
      error(request.requestId, "WORKER_RECOGNITION_UNAVAILABLE", "Loaded package does not include recognition");
      return;
    }
    const data = await api.recognize_v2_with_progress(
      request.input.width,
      request.input.height,
      request.input.pixels,
      request.input.mode,
      (event) => respond({
        protocolVersion: WORKER_PROTOCOL_VERSION,
        type: "progress",
        requestId: request.requestId,
        stage: event.stage,
        progress: event.progress,
      }),
    );
    respond({ protocolVersion: WORKER_PROTOCOL_VERSION, type: "result", requestId: request.requestId, data });
  } catch (cause) {
    error(
      request.requestId,
      "WORKER_OPERATION_FAILED",
      cause instanceof Error ? cause.message : String(cause),
    );
  }
}

scope.onmessage = (event) => {
  // Dedicated-worker MessageEvents normally have an empty origin. Reject any
  // unexpected foreign origin before reading attacker-controlled request data.
  if (event.origin !== "" && event.origin !== scope.location.origin) return;

  const validation = validateWorkerRequest(event.data, {
    assetBaseUrl: scope.location.href,
  });

  if (!validation.ok) {
    if (validation.requestId) {
      error(validation.requestId, validation.code, validation.message);
    }
    return;
  }

  const request = validation.request;

  queue = queue.then(() => handle(request)).catch((cause: unknown) => {
    error(request.requestId, "WORKER_QUEUE_FAILED", cause instanceof Error ? cause.message : String(cause));
  });
};
