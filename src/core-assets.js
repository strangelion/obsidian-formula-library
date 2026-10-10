import { WasmWorkerClient } from "../vendor/core/runtime-src/client.ts";
import { CORE_ASSET_INFO, GLUE_SOURCE, WORKER_SOURCE, WASM_BASE64 } from "./generated/core-payload.js";
import { CoreConversionError, CORE_CONVERSION_LIMITS } from "./core-conversion.js";

export { CORE_ASSET_INFO };

// All asset URLs originate here. Neither note text nor settings can supply a module URL.
// Worker isolation provides hard cancellation; it is not an untrusted-code sandbox.
export async function createBundledCoreSession({ signal } = {}) {
  if (typeof Worker !== "function" || typeof WebAssembly !== "object" || !globalThis.crypto?.subtle) {
    throw new CoreConversionError("CORE_UNAVAILABLE", "This host does not provide module Workers, WebAssembly and SHA-256 verification.");
  }
  const bytes = Uint8Array.from(atob(WASM_BASE64), (char) => char.charCodeAt(0));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== CORE_ASSET_INFO.files["latexsnipper_wasm_bg.wasm"]) {
    throw new CoreConversionError("CORE_ASSET_MISMATCH", "The bundled Core WASM failed its integrity check.");
  }
  if (signal?.aborted) throw new CoreConversionError("CANCELLED", "Core loading was cancelled.");
  const urls = [];
  const asset = (content, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    urls.push(url);
    return url;
  };
  let rawClient;
  const workers = new Set();
  let workerCreated = false;
  let stopped = false;
  let released = false;
  let generation = 0;
  let resolveMetadata, rejectMetadata;
  const metadata = new Promise((resolve, reject) => { resolveMetadata = resolve; rejectMetadata = reject; });
  // Initialization can fail before the host starts awaiting this promise.
  metadata.catch(() => {});
  const terminate = () => {
    if (stopped) return;
    stopped = true;
    // The official async startWorker can reject before assigning its worker.
    // Its terminate() is unsafe in that case; no RPC was posted or queued yet.
    try { if (workerCreated) rawClient?.terminate(); }
    finally { for (const worker of [...workers]) worker.terminate(); }
  };
  const releaseAssets = () => {
    if (!stopped) throw new CoreConversionError("CORE_CLEANUP_FAILED", "Terminate the Worker before releasing its assets.");
    if (released) return;
    released = true;
    for (const url of urls) URL.revokeObjectURL(url);
  };
  try {
    const wasmUrl = asset(bytes, "application/wasm");
    const glueUrl = asset(GLUE_SOURCE, "text/javascript");
    const token = crypto.randomUUID();
    const bridgeUrl = asset(`import initialize, * as core from ${JSON.stringify(glueUrl)};
export * from ${JSON.stringify(glueUrl)};
export default async function(wasmUrl) {
  if (wasmUrl !== ${JSON.stringify(wasmUrl)}) throw new Error("Unrecognized Core asset URL");
  await initialize({ module_or_path: wasmUrl });
  core.init();
  self.postMessage({ formulaLibraryMetadata: ${JSON.stringify(token)}, capabilities: core.formula_capabilities_v3(), apiInfo: core.api_info_v3() });
}`, "text/javascript");
    const workerUrl = asset(WORKER_SOURCE, "text/javascript");
    const workerFactory = () => {
      if (stopped) throw new Error("Core session terminated");
      let worker;
      try { worker = new Worker(workerUrl, { type: "module", name: "formula-library-conversion" }); }
      catch {
        const error = new CoreConversionError("CORE_UNAVAILABLE", "The host blocked Core Worker construction. Existing LaTeX editing remains available.");
        rejectMetadata(error);
        throw error;
      }
      workerCreated = true;
      const currentGeneration = ++generation;
      let dead = false;
      const proxy = {
        onmessage: null, onerror: null, onmessageerror: null,
        postMessage(message, transfer) {
          if (dead || stopped) throw new Error("Core Worker terminated");
          if (message.type === "initialize" && (message.options?.moduleUrl !== bridgeUrl || message.options?.wasmUrl !== wasmUrl)) {
            throw new Error("Unrecognized Core initialization URLs");
          }
          worker.postMessage(message, transfer);
        },
        terminate() {
          if (dead) return;
          dead = true;
          worker.terminate();
          workers.delete(proxy);
        },
      };
      workers.add(proxy);
      worker.onmessage = (event) => {
        if (dead || stopped || currentGeneration !== generation) return;
        if (event.data?.formulaLibraryMetadata === token) {
          const { capabilities, apiInfo } = event.data;
          const versionsMatch = (value) => value?.versions?.apiEnvelopeVersion === 3
            && value.versions.coreVersion === CORE_ASSET_INFO.coreVersion;
          if (!versionsMatch(capabilities) || apiInfo?.ok !== true || !versionsMatch(apiInfo)
            || new TextEncoder().encode(JSON.stringify(event.data)).length > CORE_CONVERSION_LIMITS.maxOutputBytes) {
            rejectMetadata(new CoreConversionError("CORE_ASSET_MISMATCH", "Core metadata does not match the bundled version."));
          } else resolveMetadata(capabilities);
          // Never forward sideband metadata: the official RPC rejects unknown IDs.
          return;
        }
        proxy.onmessage?.(event);
      };
      worker.onerror = (event) => {
        if (dead || stopped || currentGeneration !== generation) return;
        rejectMetadata(new CoreConversionError("CORE_UNAVAILABLE", "The host blocked or failed to load the Core Worker. Existing LaTeX editing remains available."));
        proxy.onerror?.(event);
      };
      worker.onmessageerror = (event) => {
        if (dead || stopped || currentGeneration !== generation) return;
        rejectMetadata(new CoreConversionError("INVALID_CORE_RESPONSE", "Core metadata could not be decoded."));
        proxy.onmessageerror?.(event);
      };
      return proxy;
    };
    rawClient = new WasmWorkerClient({ workerUrl, moduleUrl: bridgeUrl, wasmUrl, workerFactory,
      maxQueueLength: CORE_CONVERSION_LIMITS.maxQueueLength,
      rpcTimeoutMillis: CORE_CONVERSION_LIMITS.totalTimeoutMillis,
      maxFormulaDurationMillis: CORE_CONVERSION_LIMITS.totalTimeoutMillis,
      maxFormulaInputBytes: CORE_CONVERSION_LIMITS.maxInputBytes,
      maxFormulaResultBytes: CORE_CONVERSION_LIMITS.maxOutputBytes });
    rawClient.ready().catch(() => {});
    return {
      client: {
        convertFormula(request, options) {
          if (stopped) return Promise.reject(new CoreConversionError("CORE_DISPOSED", "Core session terminated."));
          return rawClient.convertFormula(request, options);
        },
        terminate,
      },
      async initialize() {
        const [, capabilities] = await Promise.all([rawClient.ready(), metadata]);
        return capabilities;
      },
      dispose: terminate,
      releaseAssets,
    };
  } catch (cause) {
    terminate(); releaseAssets();
    throw cause;
  }
}
