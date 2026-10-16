import type { ApiEnvelopeV3 } from "./types.js";
import type { WorkerCallOptions } from "./client.js";
import type { FormulaFragmentCompletionRequest } from "./completion.js";
import type { FormulaPreferenceCommand, FormulaPreferenceInfo, FormulaPreferencePolicy, PreferenceWorkerCommand, PreferredFormulaCompletion,
  FormulaPreferenceCheckpoint, FormulaPreferenceStoragePermission } from "./preferences.js";

/** Tied to one Worker generation. Neither state nor feedback is replayed after reset. */
export class WorkerFormulaPreferences {
  private isClosed = false;
  private closing: Promise<void> | undefined;
  constructor(private readonly execute: (command: PreferenceWorkerCommand, options: WorkerCallOptions) => Promise<unknown>) {}
  get closed(): boolean { return this.isClosed; }
  command<T = unknown>(command: FormulaPreferenceCommand, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<T>> {
    if (this.isClosed) return Promise.reject(new Error("Formula preferences are closed"));
    return this.execute(command, options) as Promise<ApiEnvelopeV3<T>>;
  }
  info(options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<FormulaPreferenceInfo>> { return this.command({ kind: "info" }, options); }
  setPolicy(policy: FormulaPreferencePolicy, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<{ policy: FormulaPreferencePolicy }>> {
    return this.command({ kind: "set-policy", policy }, options);
  }
  captureContext(options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<{ captureId: string }>> { return this.command({ kind: "capture" }, options); }
  rankFragments(request: FormulaFragmentCompletionRequest, options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<PreferredFormulaCompletion>> {
    return this.command({ kind: "rank-fragments", request }, options);
  }
  exportCheckpoint(storageKeyHex: string, checkpoint: string, permission: FormulaPreferenceStoragePermission,
    options: WorkerCallOptions = {}): Promise<ApiEnvelopeV3<FormulaPreferenceCheckpoint>> {
    return this.command({ kind: "export-checkpoint", storageKeyHex, checkpoint, permission }, options);
  }
  close(options: WorkerCallOptions = {}): Promise<void> {
    if (this.closing) return this.closing;
    if (this.isClosed) return Promise.resolve();
    this.isClosed = true;
    this.closing = Promise.resolve().then(() => this.execute({ kind: "close" }, options)).then((value) => {
      if (typeof value !== "object" || value === null || (value as { ok?: unknown }).ok !== true) throw new Error("Preference close was refused");
    }).catch((cause: unknown) => { this.isClosed = false; throw cause; }).finally(() => { this.closing = undefined; });
    return this.closing;
  }
}
