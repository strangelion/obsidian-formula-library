import type { ApiEnvelopeV3 } from "./types.js";
import { fragmentCompletionInputError, type FormulaDefinitionScope, type FormulaFragmentCompletion,
  type FormulaFragmentCompletionRequest, type FormulaFragmentCompletionApplyRequest } from "./completion.js";

export interface FormulaPreferencePolicy { rankingEnabled: boolean; feedbackEnabled: boolean; allowSensitiveFeedback: boolean }
export interface FormulaPreferenceConfiguration { schemaVersion: 1; scope: FormulaDefinitionScope; keyHex: string }
export interface FormulaPreferenceStoragePermission { storageEnabled: boolean; allowSensitiveStorage: boolean }
export interface FormulaPreferenceRestoreConfiguration extends FormulaPreferenceConfiguration {
  storageKeyHex: string; expectedCheckpoint: string; snapshotJson: string; permission: FormulaPreferenceStoragePermission;
}
export interface FormulaPreferenceCheckpoint { snapshotJson: string; checkpoint: string }
export const MAX_PREFERENCE_SNAPSHOT_BYTES = 256 * 1024;
export interface FormulaPreferenceInfo {
  schemaVersion: 1; scope: FormulaDefinitionScope; policy: FormulaPreferencePolicy;
  eventCount: number; captureCount: number; receiptCount: number;
  inMemory: true; persistence: false; automaticCapture: false;
  authenticatedCheckpoints?: true; automaticStorage?: false;
}
export interface PreferredFormulaCompletion {
  completion: FormulaFragmentCompletion; order: number[];
  features: { accepted: number; undone: number; lastAcceptedEvent: string }[];
}
export type FormulaPreferenceCommand = { kind: "info" } | { kind: "set-policy"; policy: FormulaPreferencePolicy }
  | { kind: "capture" } | { kind: "discard-capture"; captureId: string }
  | { kind: "rank-fragments"; request: FormulaFragmentCompletionRequest }
  | { kind: "record-acceptance"; captureId: string; eventId: string; request: FormulaFragmentCompletionApplyRequest }
  | { kind: "undo"; receiptId: string } | { kind: "clear"; generation: string; keyHex: string }
  | { kind: "export-checkpoint"; storageKeyHex: string; checkpoint: string; permission: FormulaPreferenceStoragePermission };
export type PreferenceWorkerCommand = FormulaPreferenceCommand | { kind: "close" };
export interface NativeFormulaPreferences {
  command(json: string): ApiEnvelopeV3<unknown>;
  close(): ApiEnvelopeV3<boolean>;
  free(): void;
}
export interface WasmFormulaPreferenceApi {
  create_formula_preferences_v1(json: string): NativeFormulaPreferences;
}
export interface WasmFormulaPreferenceRestoreApi {
  restore_formula_preferences_v1(json: string): NativeFormulaPreferences;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const closed = (value: Record<string, unknown>, keys: string[]): boolean => Object.keys(value).every((key) => keys.includes(key));
const decimal = (value: unknown): value is string => typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
const hash = (value: unknown): boolean => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const token = (value: unknown): boolean => typeof value === "string" && value.length > 0 && value.length <= 96;
function policy(value: unknown): boolean {
  return record(value) && closed(value, ["rankingEnabled", "feedbackEnabled", "allowSensitiveFeedback"]) &&
    typeof value.rankingEnabled === "boolean" && typeof value.feedbackEnabled === "boolean" && typeof value.allowSensitiveFeedback === "boolean";
}
function storagePermission(value: unknown): boolean {
  return record(value) && closed(value, ["storageEnabled", "allowSensitiveStorage"]) &&
    typeof value.storageEnabled === "boolean" && typeof value.allowSensitiveStorage === "boolean";
}
export function preferenceConfigurationError(value: unknown): string | undefined {
  if (!record(value) || !closed(value, ["schemaVersion", "scope", "keyHex"]) || value.schemaVersion !== 1 || !hash(value.keyHex) ||
      !record(value.scope) || !closed(value.scope, ["userSha256", "projectSha256", "documentSha256", "generation"]) ||
      !hash(value.scope.userSha256) || (value.scope.projectSha256 !== null && !hash(value.scope.projectSha256)) ||
      (value.scope.documentSha256 !== null && !hash(value.scope.documentSha256)) || !decimal(value.scope.generation)) {
    return "Invalid closed preference configuration";
  }
  return undefined;
}
export function preferenceRestoreConfigurationError(value: unknown): string | undefined {
  if (!record(value) || !closed(value, ["schemaVersion", "scope", "keyHex", "storageKeyHex", "expectedCheckpoint", "snapshotJson", "permission"]) ||
      preferenceConfigurationError({ schemaVersion: value.schemaVersion, scope: value.scope, keyHex: value.keyHex }) ||
      !hash(value.storageKeyHex) || !decimal(value.expectedCheckpoint) || !storagePermission(value.permission) ||
      typeof value.snapshotJson !== "string" || value.snapshotJson.length > MAX_PREFERENCE_SNAPSHOT_BYTES ||
      new TextEncoder().encode(value.snapshotJson).byteLength > MAX_PREFERENCE_SNAPSHOT_BYTES) {
    return "Invalid closed preference restore configuration or snapshot budget";
  }
  return undefined;
}
export function preferenceCommandError(value: unknown): string | undefined {
  const invalid = "Invalid closed preference command";
  if (!record(value)) return invalid;
  switch (value.kind) {
    case "info": case "capture": case "close": return closed(value, ["kind"]) ? undefined : invalid;
    case "set-policy": return closed(value, ["kind", "policy"]) && policy(value.policy) ? undefined : invalid;
    case "discard-capture": return closed(value, ["kind", "captureId"]) && token(value.captureId) ? undefined : invalid;
    case "undo": return closed(value, ["kind", "receiptId"]) && token(value.receiptId) ? undefined : invalid;
    case "clear": return closed(value, ["kind", "generation", "keyHex"]) && decimal(value.generation) && hash(value.keyHex) ? undefined : invalid;
    case "export-checkpoint": return closed(value, ["kind", "storageKeyHex", "checkpoint", "permission"]) && hash(value.storageKeyHex) &&
      decimal(value.checkpoint) && storagePermission(value.permission) ? undefined : invalid;
    case "rank-fragments": return closed(value, ["kind", "request"]) ? fragmentCompletionInputError(value.request, false) : invalid;
    case "record-acceptance": return closed(value, ["kind", "captureId", "eventId", "request"]) && token(value.captureId) && decimal(value.eventId)
      ? fragmentCompletionInputError(value.request, true) : invalid;
    default: return invalid;
  }
}
export function preferenceJson(value: unknown, maximum = 4096): string {
  const json = JSON.stringify(value);
  if (json === undefined || json.length > maximum || new TextEncoder().encode(json).byteLength > maximum) {
    throw new RangeError("Preference JSON exceeds its transfer budget");
  }
  return json;
}
export function preferenceCommandBudget(command: PreferenceWorkerCommand): number {
  return command.kind === "rank-fragments" || command.kind === "record-acceptance" ? 1024 * 1024 : 4096;
}

/** Host-owned synchronous object. No disk IO, automatic feedback or implicit consent. */
export class FormulaPreferences {
  private native: NativeFormulaPreferences | undefined;
  private active = false;
  constructor(api: WasmFormulaPreferenceApi, configuration: FormulaPreferenceConfiguration);
  constructor(api: WasmFormulaPreferenceRestoreApi, configuration: FormulaPreferenceRestoreConfiguration, mode: "restore");
  constructor(api: WasmFormulaPreferenceApi | WasmFormulaPreferenceRestoreApi,
    configuration: FormulaPreferenceConfiguration | FormulaPreferenceRestoreConfiguration, mode: "create" | "restore" = "create") {
    if (mode !== "create" && mode !== "restore") throw new TypeError("Invalid preference factory mode");
    const factory = mode === "restore" ? (api as WasmFormulaPreferenceRestoreApi).restore_formula_preferences_v1
      : (api as WasmFormulaPreferenceApi).create_formula_preferences_v1;
    if (typeof factory !== "function") throw new TypeError("WASM package lacks the requested preference factory");
    const cause = mode === "restore" ? preferenceRestoreConfigurationError(configuration) : preferenceConfigurationError(configuration);
    if (cause) throw new TypeError(cause);
    this.native = factory.call(api, preferenceJson(configuration, mode === "restore" ? 1024 * 1024 : 4096));
  }
  static restore(api: WasmFormulaPreferenceRestoreApi, configuration: FormulaPreferenceRestoreConfiguration): FormulaPreferences {
    return new FormulaPreferences(api, configuration, "restore");
  }
  get closed(): boolean { return this.native === undefined; }
  command<T = unknown>(command: FormulaPreferenceCommand): ApiEnvelopeV3<T> {
    const native = this.native;
    if (!native) throw new Error("Formula preferences are closed");
    if (this.active) throw new Error("Recursive preference operations are refused");
    this.active = true;
    try {
      const cause = preferenceCommandError(command);
      if (cause) throw new TypeError(cause);
      const json = preferenceJson(command, preferenceCommandBudget(command));
      // Getters/toJSON may have closed this wrapper while preparing the input.
      if (this.native !== native) throw new Error("Formula preferences were closed while preparing input");
      return native.command(json) as ApiEnvelopeV3<T>;
    } finally { this.active = false; if (!this.native) native.free(); }
  }
  info(): ApiEnvelopeV3<FormulaPreferenceInfo> { return this.command({ kind: "info" }); }
  setPolicy(policy: FormulaPreferencePolicy): ApiEnvelopeV3<{ policy: FormulaPreferencePolicy }> { return this.command({ kind: "set-policy", policy }); }
  captureContext(): ApiEnvelopeV3<{ captureId: string }> { return this.command({ kind: "capture" }); }
  rankFragments(request: FormulaFragmentCompletionRequest): ApiEnvelopeV3<PreferredFormulaCompletion> { return this.command({ kind: "rank-fragments", request }); }
  exportCheckpoint(storageKeyHex: string, checkpoint: string, permission: FormulaPreferenceStoragePermission): ApiEnvelopeV3<FormulaPreferenceCheckpoint> {
    return this.command({ kind: "export-checkpoint", storageKeyHex, checkpoint, permission });
  }
  close(): void {
    const native = this.native;
    if (!native) return;
    this.native = undefined;
    try { native.close(); } finally { if (!this.active) native.free(); }
  }
}
