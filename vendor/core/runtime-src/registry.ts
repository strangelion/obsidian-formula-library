import type { ApiEnvelopeV3 } from "./types.js";
import type { FormulaConversionMode } from "./formula.js";

export interface RegisteredFormulaRequest {
  schemaVersion: 1;
  input: string;
  output: string;
  mode: FormulaConversionMode;
  backend: string | null;
  content: string;
  contextSha256: string;
}
export interface ConversionFallbackPolicy { schemaVersion: 1; backends: string[] }
export interface ConversionFormatDescriptor { schemaVersion: 1; id: string; mimeType: string; description: string }
export interface ConversionBackendDescriptor {
  schemaVersion: 1; id: string; version: string; configurationSha256: string; license: string;
  limitations: string[];
  routes: { input: string; output: string; mode: FormulaConversionMode; target: "native" | "wasm32-unknown-unknown" }[];
  maxInputBytes: number; maxOutputBytes: number;
}
export interface ConversionCandidate { content: string; losses: { code: string; message: string }[] }
export interface ConversionFallbackReport {
  schemaVersion: 1; coreVersion: string; requestedBackend: string;
  route: unknown; policySha256: string | null; requestSha256: string | null; decisionSha256: string | null;
  attempts: unknown[];
  outcome: { kind: "converted"; result: { candidate: ConversionCandidate; [key: string]: unknown } }
    | { kind: "rejected"; error: { code: string; message: string } };
}

/** Trusted synchronous callbacks, never a browser WASI or permission sandbox. */
export interface NativeFormulaRegistry {
  register_format(json: string, validator: (content: string) => boolean): ApiEnvelopeV3<boolean>;
  register_backend(json: string, ready: () => boolean, convert: (requestJson: string) => string): ApiEnvelopeV3<boolean>;
  set_enabled(backend: string, enabled: boolean): ApiEnvelopeV3<boolean>;
  capabilities(): ApiEnvelopeV3<unknown>;
  convert(requestJson: string, policyJson: string): ApiEnvelopeV3<ConversionFallbackReport>;
  close(): ApiEnvelopeV3<boolean>;
  free(): void;
}
export interface WasmFormulaRegistryApi {
  create_formula_registry_v1(configurationKey?: string): NativeFormulaRegistry;
}

export function registryJson(value: unknown, maximum = 1024 * 1024): string {
  const json = JSON.stringify(value);
  if (json === undefined || json.length > maximum || new TextEncoder().encode(json).byteLength > maximum) {
    throw new RangeError("Registered conversion JSON exceeds its transfer budget");
  }
  return json;
}

/** Direct synchronous API; use the Worker route for hard execution interruption. */
export class FormulaRegistry {
  private native: NativeFormulaRegistry | undefined;
  private active = false;

  constructor(api: WasmFormulaRegistryApi, configurationKey?: string) {
    if (typeof api.create_formula_registry_v1 !== "function") throw new TypeError("WASM package lacks the registry factory");
    this.native = api.create_formula_registry_v1(configurationKey);
  }

  get closed(): boolean { return this.native === undefined; }

  private run<T>(operation: (native: NativeFormulaRegistry) => T): T {
    const native = this.native;
    if (!native) throw new Error("Formula registry is closed");
    if (this.active) throw new Error("Recursive registry operations are refused");
    this.active = true;
    try { return operation(native); }
    finally { this.active = false; if (!this.native) native.free(); }
  }

  registerTrustedFormat(descriptor: ConversionFormatDescriptor, validator: (content: string) => boolean): ApiEnvelopeV3<boolean> {
    return this.run((native) => native.register_format(registryJson(descriptor, 16 * 1024), validator));
  }
  registerTrustedBackend(descriptor: ConversionBackendDescriptor, ready: () => boolean,
    convert: (requestJson: string) => string): ApiEnvelopeV3<boolean> {
    return this.run((native) => native.register_backend(registryJson(descriptor, 16 * 1024), ready, convert));
  }
  setEnabled(backend: string, enabled: boolean): ApiEnvelopeV3<boolean> {
    return this.run((native) => native.set_enabled(backend, enabled));
  }
  capabilities(): ApiEnvelopeV3<unknown> { return this.run((native) => native.capabilities()); }
  convert(request: RegisteredFormulaRequest, policy: ConversionFallbackPolicy = { schemaVersion: 1, backends: [] }): ApiEnvelopeV3<ConversionFallbackReport> {
    return this.run((native) => native.convert(registryJson(request), registryJson(policy, 4096)));
  }
  close(): void {
    const native = this.native;
    if (!native) return;
    this.native = undefined;
    try { native.close(); }
    finally { if (!this.active) native.free(); }
  }
}

export type RegistryWorkerCommand = { kind: "capabilities" } | { kind: "close" }
  | { kind: "set-enabled"; backend: string; enabled: boolean }
  | { kind: "convert"; request: RegisteredFormulaRequest; policy: ConversionFallbackPolicy };
