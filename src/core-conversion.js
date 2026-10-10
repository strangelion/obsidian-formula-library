// Host-owned adapter. No Core implementation, WASM or third-party worker is bundled here.
export const CORE_CONVERSION_LIMITS = Object.freeze({
  maxInputBytes: 64 * 1024,
  maxOutputBytes: 256 * 1024,
  maxQueueLength: 8,
  totalTimeoutMillis: 30_000,
});

export const CORE_INPUT_FORMATS = Object.freeze([
  "latex", "typst", "mathml", "omml", "markdown", "unicode-math", "ascii-math", "mtef",
]);
export const CORE_OUTPUT_FORMATS = Object.freeze([
  "latex-fragment", "latex", "latex_display", "latex_equation", "typst",
  "markdown_inline", "markdown_block", "mathml", "omml", "html",
]);

const encoder = new TextEncoder();
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const byteLength = (value) => encoder.encode(value).byteLength;
const modeOf = (request) => request.mode ?? "strict";
const routeOutput = (output) => output === "latex-fragment" ? "latex_display" : output;

export class CoreConversionError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CoreConversionError";
    this.code = code;
    this.details = details;
  }
}

function adapterError(cause, fallback = "CORE_UNAVAILABLE") {
  if (cause instanceof CoreConversionError) return cause;
  const code = cause?.detail?.code ?? cause?.code;
  return new CoreConversionError(
    typeof code === "string" ? code : fallback,
    typeof cause?.message === "string" ? cause.message : "The conversion backend is unavailable.",
    cause?.detail ?? undefined,
  );
}

function requirePositiveInteger(name, value, ceiling = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > ceiling) {
    throw new RangeError(`${name} must be a positive safe integer no greater than ${ceiling}.`);
  }
}

function validateEnvelope(envelope, maxBytes) {
  if (!isRecord(envelope) || typeof envelope.ok !== "boolean" || !isRecord(envelope.versions)
    || envelope.versions.apiEnvelopeVersion !== 3 || typeof envelope.versions.coreVersion !== "string"
    || !envelope.versions.coreVersion.length) {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "The backend returned an invalid Core envelope.");
  }
  if (envelope.diagnostics !== undefined && !Array.isArray(envelope.diagnostics)) {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "Core diagnostics must be an array.");
  }
  if (!envelope.ok && (!isRecord(envelope.error) || typeof envelope.error.code !== "string")) {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "The Core failure envelope has no error code.");
  }
  let serialized;
  try { serialized = JSON.stringify(envelope); } catch {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "The Core envelope is not serializable.");
  }
  if (serialized.length > maxBytes || byteLength(serialized) > maxBytes) {
    throw new CoreConversionError("OUTPUT_TOO_LARGE", "The Core envelope exceeds the output byte limit.");
  }
  return envelope;
}

function capabilityRows(envelopeOrRows) {
  return Array.isArray(envelopeOrRows) ? envelopeOrRows : envelopeOrRows?.data;
}

// The fragment API uses the registered latex_display route, then a checked projection.
// A format enum is not evidence that a route is executable; callers must inspect available.
export function findConversionRoute(envelopeOrRows, request) {
  const rows = capabilityRows(envelopeOrRows);
  if (!Array.isArray(rows)) return undefined;
  return rows.find((row) => row?.input === request.inputFormat
    && row.output === routeOutput(request.outputFormat ?? "latex-fragment")
    && row.mode === modeOf(request));
}

function validateCapabilities(envelope, maxBytes) {
  validateEnvelope(envelope, maxBytes);
  if (!envelope.ok) return envelope;
  if (!Array.isArray(envelope.data) || !envelope.data.every((row) => isRecord(row)
    && typeof row.input === "string" && typeof row.output === "string"
    && (row.mode === "strict" || row.mode === "best-effort")
    && typeof row.available === "boolean")) {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "Core capabilities must contain valid route records.");
  }
  return envelope;
}

function validateRequest(request, maxInputBytes) {
  if (!isRecord(request) || typeof request.content !== "string") {
    throw new CoreConversionError("INVALID_ARGUMENT", "Provide a non-empty formula string.");
  }
  if (request.content.length > maxInputBytes || byteLength(request.content) > maxInputBytes) {
    throw new CoreConversionError("INPUT_TOO_LARGE", "The formula exceeds the UTF-8 input byte limit.");
  }
  if (!request.content.trim()) {
    throw new CoreConversionError("INVALID_ARGUMENT", "Provide a non-empty formula string.");
  }
  const outputFormat = request.outputFormat ?? "latex-fragment";
  const mode = modeOf(request);
  if (!CORE_INPUT_FORMATS.includes(request.inputFormat) || !CORE_OUTPUT_FORMATS.includes(outputFormat)
    || !["strict", "best-effort"].includes(mode)) {
    throw new CoreConversionError("INVALID_ARGUMENT", "Unknown formula format or conversion mode.");
  }
  if (request.requestId !== undefined && (typeof request.requestId !== "string"
    || !request.requestId.length || request.requestId.length > 256)) {
    throw new CoreConversionError("INVALID_ARGUMENT", "A request ID must contain between 1 and 256 characters.");
  }
  return { content: request.content, inputFormat: request.inputFormat, outputFormat, mode, requestId: request.requestId };
}

function validateResult(envelope, request, maxBytes) {
  validateEnvelope(envelope, maxBytes);
  // Preserve genuine Core errors and diagnostics for the UI instead of changing their meaning.
  if (!envelope.ok) return envelope;
  const data = envelope.data;
  const capability = data?.capability;
  if (!isRecord(data) || typeof data.content !== "string" || !data.content.trim()
    || !isRecord(capability) || capability.available !== true
    || capability.input !== request.inputFormat || capability.output !== routeOutput(request.outputFormat)
    || capability.mode !== request.mode) {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "The Core result does not match the requested route.");
  }
  if (request.outputFormat === "latex-fragment" && data.contentKind !== "latex-fragment") {
    throw new CoreConversionError("INVALID_CORE_RESPONSE", "The backend did not return a checked bare formula.");
  }
  return envelope;
}

/**
 * createSession({ signal }) is supplied by the host's separately licensed asset bridge.
 * It returns { client, initialize, dispose?, releaseAssets? }:
 * - initialize({ signal }) initializes the dedicated Worker AND queries capabilities
 *   inside that Worker, returning its untouched Core capability envelope.
 * - client.convertFormula(request, { signal, timeoutMillis }) is the official RPC.
 * - client.terminate() must stop execution/recovery before resolving.
 * - releaseAssets() revokes resources only after terminate and optional dispose finish.
 * The factory owns cleanup when creation fails before it returns a session.
 * No main-thread conversion, download or implicit best-effort fallback is provided.
 */
export class CoreConversionService {
  constructor(options = {}) {
    if (typeof options.createSession !== "function") {
      throw new TypeError("CoreConversionService requires an injected createSession factory.");
    }
    this.createSession = options.createSession;
    this.limits = Object.freeze(Object.fromEntries(Object.entries(CORE_CONVERSION_LIMITS)
      .map(([key, value]) => [key, options[key] ?? value])));
    requirePositiveInteger("maxInputBytes", this.limits.maxInputBytes, CORE_CONVERSION_LIMITS.maxInputBytes);
    requirePositiveInteger("maxOutputBytes", this.limits.maxOutputBytes, CORE_CONVERSION_LIMITS.maxOutputBytes);
    requirePositiveInteger("maxQueueLength", this.limits.maxQueueLength);
    requirePositiveInteger("totalTimeoutMillis", this.limits.totalTimeoutMillis, CORE_CONVERSION_LIMITS.totalTimeoutMillis);
    this._session = null;
    this._capabilities = null;
    this._queue = [];
    this._active = null;
    this._sequence = 0;
    this._generation = 0;
    this._disposed = false;
    this._closing = Promise.resolve();
    this._cleanupError = null;
    this._closedSessions = new WeakSet();
  }

  get disposed() { return this._disposed; }
  get ready() { return !this._disposed && this._capabilities?.ok === true; }

  getCapabilities({ signal } = {}) {
    return this._enqueue({ kind: "capabilities", signal });
  }

  convert(request, { signal, supersedeKey = "default" } = {}) {
    let normalized;
    try {
      normalized = validateRequest(request, this.limits.maxInputBytes);
      if (supersedeKey !== null && (typeof supersedeKey !== "string" || !supersedeKey.length)) {
        throw new CoreConversionError("INVALID_ARGUMENT", "Use a non-empty supersede key or null.");
      }
    } catch (error) { return Promise.reject(error); }
    return this._enqueue({ kind: "conversion", request: normalized, signal, supersedeKey });
  }

  async reset() {
    this._cancelAll(new CoreConversionError("CORE_RESET", "The conversion backend was reset."));
    this._dropSession();
    await this._closing;
    if (this._cleanupError) throw this._cleanupError;
  }

  async dispose() {
    if (this._disposed) {
      await this._closing;
      if (this._cleanupError) throw this._cleanupError;
      return;
    }
    this._disposed = true;
    this._cancelAll(new CoreConversionError("CORE_DISPOSED", "The conversion service was disposed."));
    this._dropSession();
    await this._closing;
    if (this._cleanupError) throw this._cleanupError;
  }

  _enqueue(input) {
    if (this._disposed) return Promise.reject(new CoreConversionError("CORE_DISPOSED", "The conversion service is disposed."));
    if (input.signal?.aborted) return Promise.reject(new CoreConversionError("CANCELLED", "The conversion request was cancelled."));
    if (input.signal !== undefined && (typeof input.signal.addEventListener !== "function"
      || typeof input.signal.removeEventListener !== "function")) {
      return Promise.reject(new CoreConversionError("INVALID_ARGUMENT", "signal must be an AbortSignal."));
    }
    if (input.supersedeKey !== null && input.supersedeKey !== undefined) {
      for (const previous of [this._active, ...this._queue]) {
        if (previous && !previous.finished && previous.supersedeKey === input.supersedeKey) {
          this._cancel(previous, new CoreConversionError("SUPERSEDED", "A newer conversion request replaced this one."));
        }
      }
    }
    if (this._queue.length >= this.limits.maxQueueLength) {
      return Promise.reject(new CoreConversionError("CORE_QUEUE_FULL", "The conversion queue is full."));
    }
    return new Promise((resolve, reject) => {
      const job = { ...input, resolve, reject, controller: new AbortController(), finished: false,
        deadline: Date.now() + this.limits.totalTimeoutMillis };
      job.request = input.request ? { ...input.request, requestId: input.request.requestId ?? `formula-library:${++this._sequence}` } : null;
      job.abortListener = () => this._cancel(job, new CoreConversionError("CANCELLED", "The conversion request was cancelled."));
      input.signal?.addEventListener("abort", job.abortListener, { once: true });
      job.timer = setTimeout(() => this._cancel(job,
        new CoreConversionError("CORE_TIMEOUT", "The total conversion deadline expired.")), this.limits.totalTimeoutMillis);
      this._queue.push(job);
      this._pump();
    });
  }

  _finish(job, error, result) {
    if (job.finished) return;
    job.finished = true;
    clearTimeout(job.timer);
    job.signal?.removeEventListener("abort", job.abortListener);
    const index = this._queue.indexOf(job);
    if (index !== -1) this._queue.splice(index, 1);
    if (error) job.reject(error); else job.resolve(result);
  }

  _cancel(job, error) {
    if (job.finished) return;
    this._finish(job, error);
    // Abort reaches the official client first, including its hard-cancel path.
    job.controller.abort(error);
    if (this._active === job) this._dropSession();
  }

  _cancelAll(error) {
    for (const job of [this._active, ...this._queue]) if (job) this._cancel(job, error);
  }

  _dropSession() {
    this._generation += 1;
    const session = this._session;
    this._session = null;
    this._capabilities = null;
    if (session) this._scheduleClose(session);
  }

  _scheduleClose(session) {
    if (!isRecord(session) || this._closedSessions.has(session)) return;
    this._closedSessions.add(session);
    const close = async () => {
      // Do not revoke URLs while an executing/recovering worker may still need them.
      if (typeof session.client?.terminate === "function") await session.client.terminate();
      else if (typeof session.dispose !== "function") {
        throw new CoreConversionError("CORE_CLEANUP_FAILED", "The session cannot terminate its Worker.");
      }
      if (typeof session.dispose === "function") await session.dispose();
      if (typeof session.releaseAssets === "function") await session.releaseAssets();
    };
    this._closing = this._closing.then(close).catch((cause) => {
      this._cleanupError = adapterError(cause, "CORE_CLEANUP_FAILED");
    });
  }

  _wait(promise, job) {
    const signal = job.controller.signal;
    if (signal.aborted) {
      // Retain a rejection handler even for a factory that completes after this abort.
      Promise.resolve(promise).catch(() => {});
      return Promise.reject(signal.reason);
    }
    return new Promise((resolve, reject) => {
      const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
      signal.addEventListener("abort", abort, { once: true });
      Promise.resolve(promise).then(
        (result) => { signal.removeEventListener("abort", abort); resolve(result); },
        (error) => { signal.removeEventListener("abort", abort); reject(error); },
      );
    });
  }

  async _ensureSession(job) {
    await this._wait(this._closing, job);
    if (this._cleanupError) throw this._cleanupError;
    if (this._session && this._capabilities) return this._session;
    const generation = this._generation;
    const creation = Promise.resolve().then(() => this.createSession({ signal: job.controller.signal }));
    // A slow factory may complete after cancellation/disposal. Clean its resources too.
    const checkedCreation = creation.then((session) => {
      if (generation !== this._generation || job.controller.signal.aborted || this._disposed) {
        this._scheduleClose(session);
        throw new CoreConversionError("CANCELLED", "The conversion session became obsolete while loading.");
      }
      this._session = session;
      return session;
    });
    const session = await this._wait(checkedCreation, job);
    if (!isRecord(session) || typeof session.initialize !== "function"
      || typeof session.client?.convertFormula !== "function" || typeof session.client?.terminate !== "function") {
      throw new CoreConversionError("CORE_UNAVAILABLE", "The asset bridge returned an invalid dedicated Worker session.");
    }
    const capabilities = await this._wait(session.initialize({ signal: job.controller.signal }), job);
    if (generation !== this._generation || this._disposed) {
      throw new CoreConversionError("CORE_RESET", "The conversion session was replaced while loading.");
    }
    this._capabilities = validateCapabilities(capabilities, this.limits.maxOutputBytes);
    return session;
  }

  async _run(job) {
    const session = await this._ensureSession(job);
    if (job.kind === "capabilities" || !this._capabilities.ok) return this._capabilities;
    const route = findConversionRoute(this._capabilities, job.request);
    if (!route || route.available !== true) {
      throw new CoreConversionError("UNSUPPORTED_FORMAT", route?.unavailableReason
        ?? "The installed Core does not support this format and mode.", { route });
    }
    const remaining = job.deadline - Date.now();
    if (remaining <= 0) throw new CoreConversionError("CORE_TIMEOUT", "The total conversion deadline expired.");
    const result = await this._wait(session.client.convertFormula(job.request, {
      signal: job.controller.signal, timeoutMillis: remaining,
    }), job);
    return validateResult(result, job.request, this.limits.maxOutputBytes);
  }

  _pump() {
    if (this._active || this._disposed) return;
    const job = this._queue.shift();
    if (!job) return;
    this._active = job;
    Promise.resolve().then(() => this._run(job)).then(
      (result) => this._finish(job, null, result),
      (cause) => {
        const error = adapterError(cause);
        if (!job.finished && !["UNSUPPORTED_FORMAT", "INVALID_ARGUMENT"].includes(error.code)) this._dropSession();
        this._finish(job, error);
      },
    ).finally(() => {
      if (this._active === job) this._active = null;
      this._pump();
    });
  }
}
