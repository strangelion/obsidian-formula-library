import {
  WORKER_PROTOCOL_VERSION,
  type WorkerRequest,
  type WorkerResponse,
} from "./types.js";
import { validateWorkerRequest } from "./worker-request-validation.js";
import type { WasmFormulaApi, WasmFormulaFragmentApi } from "./formula.js";

interface WasmApi {
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
