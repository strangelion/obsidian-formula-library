import type { ApiEnvelopeV3 } from "./types.js";
import type { WorkerCallOptions } from "./client.js";
import type { ConversionFallbackPolicy, ConversionFallbackReport, RegisteredFormulaRequest, RegistryWorkerCommand } from "./registry.js";
export type { RegistryWorkerCommand } from "./registry.js";

/** Worker-local instance; reset/abort never implicitly restores or replays it. */
export class WorkerFormulaRegistry {
  private isClosed = false;
  private closing: Promise<void> | undefined;
  constructor(private readonly execute: (command: RegistryWorkerCommand, options: WorkerCallOptions) => Promise<unknown>) {}
  get closed(): boolean { return this.isClosed; }
  private call(command: RegistryWorkerCommand, options: WorkerCallOptions): Promise<unknown> {
    if (this.isClosed) return Promise.reject(new Error("Formula registry is closed"));
    return this.execute(command, options);
  }
  capabilities(options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<unknown>> {
    return this.call({ kind: "capabilities" }, options) as Promise<ApiEnvelopeV3<unknown>>;
  }
  setEnabled(backend: string, enabled: boolean, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<boolean>> {
    return this.call({ kind: "set-enabled", backend, enabled }, options) as Promise<ApiEnvelopeV3<boolean>>;
  }
  convert(request: RegisteredFormulaRequest, policy: ConversionFallbackPolicy = { schemaVersion: 1, backends: [] },
    options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<ConversionFallbackReport>> {
    return this.call({ kind: "convert", request, policy }, options) as Promise<ApiEnvelopeV3<ConversionFallbackReport>>;
  }
  close(options: WorkerCallOptions = {}): Promise<void> {
    if (this.closing) return this.closing;
    if (this.isClosed) return Promise.resolve();
    this.isClosed = true;
    this.closing = Promise.resolve().then(() => this.execute({ kind: "close" }, options))
      .then(() => {}, (cause: unknown) => { this.isClosed = false; throw cause; })
      .finally(() => { this.closing = undefined; });
    return this.closing;
  }
}
