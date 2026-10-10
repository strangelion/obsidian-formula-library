export const WORKER_PROTOCOL_VERSION = 1 as const;
export const API_ENVELOPE_VERSION_V3 = 3 as const;
export const CAPABILITY_SCHEMA_VERSION_V3 = 3 as const;
export const DIAGNOSTIC_SCHEMA_VERSION_V3 = 1 as const;

export interface ApiContractVersionsV3 {
  apiEnvelopeVersion: typeof API_ENVELOPE_VERSION_V3;
  capabilitySchemaVersion: typeof CAPABILITY_SCHEMA_VERSION_V3;
  diagnosticSchemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION_V3;
  documentSchemaVersion: string;
  coreVersion: string;
}

export interface ApiErrorV3 {
  code: string;
  message: string;
  recoverable: boolean;
  details?: unknown;
}

export interface ApiDiagnosticV3 {
  level: "Info" | "Warning" | "Error";
  code: string;
  message: string;
  source: unknown | null;
  recoverable: boolean;
  data: unknown;
}

export type ApiEnvelopeV3<T> =
  | {
      ok: true;
      versions: ApiContractVersionsV3;
      diagnostics?: ApiDiagnosticV3[];
      data: T;
      error?: never;
    }
  | {
      ok: false;
      versions: ApiContractVersionsV3;
      diagnostics?: ApiDiagnosticV3[];
      data?: never;
      error: ApiErrorV3;
    };

export interface WasmApiInfoV3 {
  wasmApiVersion: typeof API_ENVELOPE_VERSION_V3;
  capabilitySchemaVersion: typeof CAPABILITY_SCHEMA_VERSION_V3;
  coreVersion: string;
  documentSchemaVersion: string;
  v2CompatibilityExports: boolean;
}

export interface WasmCapabilityDocumentV3 {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION_V3;
  v2CompatibilityExports: boolean;
  recognition: unknown[];
  exports: unknown[];
  memoryLimits: unknown;
  memoryUsage: unknown;
  asyncRecognition: boolean;
  progressCallbacks: boolean;
  cancellation: {
    supported: boolean;
    mode: string;
    canInterruptActiveInference: boolean;
  };
  workerExecution: {
    availableInRustPackage: boolean;
    officialWrapper: string;
    hardCancellationMode: string;
    discardsModelSessionsOnTermination: boolean;
    maxConcurrentRecognitions: number;
  };
  indexedDbCache: WasmBrowserFeatureCapability;
  incrementalDownloads: WasmBrowserFeatureCapability;
}

export interface WasmBrowserFeatureCapability {
  availableInRustPackage: boolean;
  availableInOfficialWrapper: boolean;
  runtimeDetectionRequired: boolean;
}

export interface WasmArtifactV3 {
  format: string;
  mimeType: string;
  suggestedFileName: string | null;
  text: string | null;
  bytes?: Uint8Array;
  diagnostics: ApiDiagnosticV3[];
  checksum: string | null;
  sizeBytes: number;
}

export interface WorkerInitOptions {
  moduleUrl: string;
  wasmUrl?: string;
}

export interface ModelArtifact {
  name: string;
  bytes: Uint8Array;
  expectedSha256: string;
}

export interface RecognitionInput {
  requestId?: string;
  width: number;
  height: number;
  pixels: Uint8Array;
  mode: string;
}

export interface FormulaWorkerInput {
  requestId?: string;
  content: string;
  inputFormat: FormulaInputFormat;
  outputFormat: FormulaOutputFormat | "latex-fragment";
  mode?: FormulaConversionMode;
}

export interface ProgressEvent {
  requestId: string;
  stage: string;
  progress: number;
}

export type WorkerRequest =
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "convert-formula";
      requestId: string;
      input: Omit<FormulaWorkerInput, "requestId">;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "initialize";
      requestId: string;
      options: WorkerInitOptions;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "load-model";
      requestId: string;
      artifact: ModelArtifact;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "recognize";
      requestId: string;
      input: Omit<RecognitionInput, "requestId">;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      /** Stage-boundary only; this message cannot preempt a running serialized handler. */
      type: "cooperative-cancel";
      requestId: string;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "clear-models";
      requestId: string;
    };

export type WorkerResponse =
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "result";
      requestId: string;
      data: unknown;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "progress";
      requestId: string;
      stage: string;
      progress: number;
    }
  | {
      protocolVersion: typeof WORKER_PROTOCOL_VERSION;
      type: "error";
      requestId: string;
      error: WorkerError;
    };

export interface WorkerError {
  code: string;
  message: string;
  recoverable: boolean;
  hardCancellation?: boolean;
  workerRestarted?: boolean;
  details?: unknown;
}

export interface WorkerLike {
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
}

export type WorkerFactory = () => WorkerLike;
import type { FormulaInputFormat, FormulaOutputFormat, FormulaConversionMode } from "./formula.js";
