import {
  WORKER_PROTOCOL_VERSION,
  type WorkerRequest,
} from "./types.js";

export type WorkerRequestValidationResult =
  | { ok: true; request: WorkerRequest }
  | {
      ok: false;
      requestId?: string;
      code: "WORKER_INVALID_REQUEST" | "WORKER_PROTOCOL_MISMATCH";
      message: string;
    };

export interface WorkerRequestValidationOptions {
  /** URL of the worker script used to resolve and constrain runtime assets. */
  assetBaseUrl?: string;
}

import { completionInputError, scopedCompletionInputError, fragmentCompletionInputError } from "./completion.js";
import { preferenceConfigurationError, preferenceRestoreConfigurationError, preferenceCommandError, preferenceCommandBudget, preferenceJson, type PreferenceWorkerCommand } from "./preferences.js";

const MAX_REQUEST_ID_LENGTH = 256;
const MAX_NAME_LENGTH = 256;
const MAX_URL_LENGTH = 8_192;
const MAX_MODE_LENGTH = 128;
const DEFAULT_ASSET_BASE_URL = "https://worker.invalid/";
const ALLOWED_ASSET_PROTOCOLS = new Set(["http:", "https:", "blob:"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isOptionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || isNonEmptyString(value, maxLength);
}

function requestIdFrom(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const rid = value.requestId;
  return isNonEmptyString(rid, MAX_REQUEST_ID_LENGTH) ? rid : undefined;
}

function invalid(value: unknown, message: string): WorkerRequestValidationResult {
  return { ok: false, requestId: requestIdFrom(value), code: "WORKER_INVALID_REQUEST", message };
}

function validateAssetUrl(
  value: string,
  field: string,
  baseUrl: string,
): string | undefined {
  let base: URL;
  let resolved: URL;
  try {
    base = new URL(baseUrl);
    resolved = new URL(value, base);
  } catch {
    return `${field} must be a valid URL`;
  }

  if (!ALLOWED_ASSET_PROTOCOLS.has(resolved.protocol)) {
    return `${field} uses a forbidden URL scheme`;
  }
  if (resolved.origin !== base.origin) {
    return `${field} must resolve to the worker origin`;
  }
  return undefined;
}

function validateInitialize(
  value: Record<string, unknown>,
  validationOptions: WorkerRequestValidationOptions,
): WorkerRequestValidationResult {
  const options = value.options;
  if (!isRecord(options)) {
    return invalid(value, "Initialize request requires an options object");
  }
  if (!isNonEmptyString(options.moduleUrl, MAX_URL_LENGTH)) {
    return invalid(value, "Initialize options.moduleUrl must be a non-empty string");
  }
  if (!isOptionalString(options.wasmUrl, MAX_URL_LENGTH)) {
    return invalid(value, "Initialize options.wasmUrl must be a string when provided");
  }
  const baseUrl = validationOptions.assetBaseUrl ?? DEFAULT_ASSET_BASE_URL;
  const moduleUrlError = validateAssetUrl(
    options.moduleUrl,
    "Initialize options.moduleUrl",
    baseUrl,
  );
  if (moduleUrlError) return invalid(value, moduleUrlError);
  if (options.wasmUrl !== undefined) {
    const wasmUrlError = validateAssetUrl(
      options.wasmUrl,
      "Initialize options.wasmUrl",
      baseUrl,
    );
    if (wasmUrlError) return invalid(value, wasmUrlError);
  }
  return { ok: true, request: value as unknown as WorkerRequest };
}

function validateLoadModel(value: Record<string, unknown>): WorkerRequestValidationResult {
  const artifact = value.artifact;
  if (!isRecord(artifact)) {
    return invalid(value, "Load-model request requires an artifact object");
  }
  if (!isNonEmptyString(artifact.name, MAX_NAME_LENGTH)) {
    return invalid(value, "Model artifact name must be a non-empty string");
  }
  if (!(artifact.bytes instanceof Uint8Array)) {
    return invalid(value, "Model artifact bytes must be a Uint8Array");
  }
  if (typeof artifact.expectedSha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(artifact.expectedSha256)) {
    return invalid(value, "Model expectedSha256 must be a 64-character hexadecimal SHA-256 digest");
  }
  return { ok: true, request: value as unknown as WorkerRequest };
}

function validateRecognize(value: Record<string, unknown>): WorkerRequestValidationResult {
  const input = value.input;
  if (!isRecord(input)) {
    return invalid(value, "Recognize request requires an input object");
  }
  if (!Number.isSafeInteger(input.width) || (input.width as number) <= 0) {
    return invalid(value, "Recognition width must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.height) || (input.height as number) <= 0) {
    return invalid(value, "Recognition height must be a positive safe integer");
  }
  if (!(input.pixels instanceof Uint8Array)) {
    return invalid(value, "Recognition pixels must be a Uint8Array");
  }
  if (!isNonEmptyString(input.mode, MAX_MODE_LENGTH)) {
    return invalid(value, "Recognition mode must be a non-empty string");
  }
  const pixelCount = (input.width as number) * (input.height as number);
  if (!Number.isSafeInteger(pixelCount)) {
    return invalid(value, "Recognition dimensions overflow the safe integer range");
  }
  const expectedBytes = pixelCount * 4;
  if (!Number.isSafeInteger(expectedBytes) || input.pixels.byteLength !== expectedBytes) {
    return invalid(value, "RGBA pixel length does not match image dimensions");
  }
  return { ok: true, request: value as unknown as WorkerRequest };
}

function validateFormula(value: Record<string, unknown>): WorkerRequestValidationResult {
  const input = value.input;
  if (!isRecord(input) || typeof input.content !== "string") {
    return invalid(value, "Formula conversion requires non-empty string content");
  }
  // Check UTF-16 length first so over-limit input cannot allocate a huge encoder buffer.
  if (input.content.length > 64 * 1024 || new TextEncoder().encode(input.content).byteLength > 64 * 1024) {
    return invalid(value, "Formula input exceeds 64 KiB UTF-8");
  }
  if (input.content.trim().length === 0) return invalid(value, "Formula conversion requires non-empty string content");
  if (typeof input.inputFormat !== "string" || !["latex", "typst", "mathml", "omml", "markdown", "unicode-math", "ascii-math", "mtef"].includes(input.inputFormat)) {
    return invalid(value, "Unknown formula input format");
  }
  if (typeof input.outputFormat !== "string" || !["latex", "latex_display", "latex_equation", "typst", "markdown_inline", "markdown_block", "mathml", "omml", "html", "latex-fragment", "unicode-math", "ascii-math"].includes(input.outputFormat)) {
    return invalid(value, "Unknown formula output format");
  }
  if (input.mode !== undefined && input.mode !== "strict" && input.mode !== "best-effort") {
    return invalid(value, "Formula conversion mode must be strict or best-effort");
  }
  return { ok: true, request: value as unknown as WorkerRequest };
}

function closed(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validateRegistry(value: Record<string, unknown>): WorkerRequestValidationResult {
  if (value.type === "formula-registry-create") {
    if (!closed(value, ["type", "protocolVersion", "requestId", "configurationKey"]) ||
        !isOptionalString(value.configurationKey, 96) || (typeof value.configurationKey === "string" && !/^[a-z][a-z0-9._:-]*$/.test(value.configurationKey))) {
      return invalid(value, "Invalid closed registry creation request");
    }
    return { ok: true, request: value as unknown as WorkerRequest };
  }
  if (!closed(value, ["type", "protocolVersion", "requestId", "registryId", "command"]) ||
      !isNonEmptyString(value.registryId, 96) || !isRecord(value.command)) return invalid(value, "Invalid registry command");
  const command = value.command;
  if (command.kind === "capabilities" || command.kind === "close") {
    if (!closed(command, ["kind"])) return invalid(value, "Unknown registry command fields");
  } else if (command.kind === "set-enabled") {
    if (!closed(command, ["kind", "backend", "enabled"]) || !isNonEmptyString(command.backend, 96) || typeof command.enabled !== "boolean") {
      return invalid(value, "Invalid backend enablement");
    }
  } else if (command.kind === "convert") {
    const request = command.request;
    const policy = command.policy;
    if (!closed(command, ["kind", "request", "policy"]) || !isRecord(request) || !isRecord(policy) ||
        !closed(request, ["schemaVersion", "input", "output", "mode", "backend", "content", "contextSha256"]) ||
        !closed(policy, ["schemaVersion", "backends"]) || request.schemaVersion !== 1 || policy.schemaVersion !== 1 ||
        !isNonEmptyString(request.input, 96) || !isNonEmptyString(request.output, 96) ||
        (request.mode !== "strict" && request.mode !== "best-effort") ||
        (request.backend !== null && !isNonEmptyString(request.backend, 96)) ||
        typeof request.content !== "string" || request.content.length > 65536 ||
        new TextEncoder().encode(request.content).byteLength > 65536 || request.content.trim() === "" ||
        typeof request.contextSha256 !== "string" || !/^[a-f0-9]{64}$/.test(request.contextSha256) ||
        !Array.isArray(policy.backends) || policy.backends.length > 3 || !policy.backends.every((id) => isNonEmptyString(id, 96))) {
      return invalid(value, "Invalid closed registered formula request or policy");
    }
  } else return invalid(value, "Unknown registry command kind");
  return { ok: true, request: value as unknown as WorkerRequest };
}

function validatePreferences(value: Record<string, unknown>): WorkerRequestValidationResult {
  try {
    if (value.type === "formula-preferences-create" || value.type === "formula-preferences-restore") {
      const restore = value.type === "formula-preferences-restore";
      if (!closed(value, ["protocolVersion", "type", "requestId", "configuration"]) ||
          (restore ? preferenceRestoreConfigurationError : preferenceConfigurationError)(value.configuration)) {
        return invalid(value, "Invalid preference creation request");
      }
      if (restore) preferenceJson(value, 1024 * 1024);
      else preferenceJson(value.configuration);
    } else {
      if (!closed(value, ["protocolVersion", "type", "requestId", "ownerId", "command"]) || !isNonEmptyString(value.ownerId, 96) || preferenceCommandError(value.command)) {
        return invalid(value, "Invalid preference command request");
      }
      preferenceJson(value.command, preferenceCommandBudget(value.command as PreferenceWorkerCommand));
    }
    return { ok: true, request: value as unknown as WorkerRequest };
  } catch { return invalid(value, "Preference transfer budget or JSON encoding is invalid"); }
}

export function validateWorkerRequest(
  value: unknown,
  options: WorkerRequestValidationOptions = {},
): WorkerRequestValidationResult {
  if (!isRecord(value)) {
    return invalid(value, "Worker message must be an object");
  }
  if (!isNonEmptyString(value.requestId, MAX_REQUEST_ID_LENGTH)) {
    return invalid(value, "Worker requestId must be a non-empty string");
  }
  if (value.protocolVersion !== WORKER_PROTOCOL_VERSION) {
    return {
      ok: false,
      requestId: value.requestId as string,
      code: "WORKER_PROTOCOL_MISMATCH",
      message: `Unsupported worker protocol version '${String(value.protocolVersion)}'`,
    };
  }
  switch (value.type) {
    case "initialize":
      return validateInitialize(value, options);
    case "load-model":
      return validateLoadModel(value);
    case "recognize":
      return validateRecognize(value);
    case "convert-formula":
      return validateFormula(value);
    case "complete-formula":
    case "apply-formula-completion":
    case "complete-formula-scoped":
    case "apply-formula-completion-scoped":
    case "complete-formula-fragments":
    case "apply-formula-completion-fragments": {
      if (!closed(value, ["type", "protocolVersion", "requestId", "input"])) return invalid(value, "Unknown completion message fields");
      const scoped = value.type === "complete-formula-scoped" || value.type === "apply-formula-completion-scoped";
      const fragments = value.type === "complete-formula-fragments" || value.type === "apply-formula-completion-fragments";
      const cause = (fragments ? fragmentCompletionInputError : scoped ? scopedCompletionInputError : completionInputError)(value.input,
        value.type === "apply-formula-completion" || value.type === "apply-formula-completion-scoped" || value.type === "apply-formula-completion-fragments");
      return cause ? invalid(value, cause) : { ok: true, request: value as unknown as WorkerRequest };
    }
    case "formula-preferences-create":
    case "formula-preferences-restore":
    case "formula-preferences-command":
      return validatePreferences(value);
    case "formula-registry-create":
    case "formula-registry-command":
      return validateRegistry(value);
    case "cooperative-cancel":
    case "clear-models":
      return { ok: true, request: value as unknown as WorkerRequest };
    default:
      return invalid(value, `Unsupported worker request type '${String(value.type)}'`);
  }
}
