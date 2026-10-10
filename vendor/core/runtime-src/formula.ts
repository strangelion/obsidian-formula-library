import type { ApiEnvelopeV3 } from "./types.js";

export type FormulaInputFormat =
  | "latex" | "mathml" | "omml" | "typst" | "markdown"
  | "unicode-math" | "ascii-math" | "mtef";
export type FormulaOutputFormat =
  | "latex" | "latex_display" | "latex_equation" | "typst"
  | "markdown_inline" | "markdown_block" | "mathml" | "omml" | "html";
export type FormulaConversionMode = "strict" | "best-effort";

export interface FormulaConversionCapability {
  input: FormulaInputFormat;
  output: FormulaOutputFormat;
  mode: FormulaConversionMode;
  target: "native" | "wasm32-unknown-unknown";
  available: boolean;
  path: string;
  limitations: string[];
  unavailableReason?: string | null;
}

export interface FormulaConversionResult {
  content: string;
  capability: FormulaConversionCapability;
}

export interface FormulaFragmentResult extends FormulaConversionResult {
  /** Capability is the underlying latex_display route, not a fidelity claim. */
  contentKind: "latex-fragment";
}

/** Feature-detect the additive export when supporting older WASM packages. */
export interface WasmFormulaFragmentApi extends WasmFormulaApi {
  convert_formula_fragment_v3(
    content: string, inputFormat: string, mode?: string,
  ): ApiEnvelopeV3<FormulaFragmentResult>;
}

export function convertFormulaFragment(
  api: WasmFormulaFragmentApi,
  content: string,
  options: { inputFormat: FormulaInputFormat; mode?: FormulaConversionMode },
): ApiEnvelopeV3<FormulaFragmentResult> {
  return api.convert_formula_fragment_v3(content, options.inputFormat, options.mode ?? "strict");
}

/** Feature-detect these additive exports on older generated WASM packages. */
export interface WasmFormulaApi {
  formula_capabilities_v3(): ApiEnvelopeV3<FormulaConversionCapability[]>;
  convert_formula_v3(
    content: string, inputFormat: string, outputFormat: string, mode?: string,
  ): ApiEnvelopeV3<FormulaConversionResult>;
}

export function formulaConversionCapabilities(
  api: WasmFormulaApi,
): ApiEnvelopeV3<FormulaConversionCapability[]> {
  return api.formula_capabilities_v3();
}

/** Synchronous, model-free conversion. Use a caller-owned worker to avoid UI work. */
export function convertFormula(
  api: WasmFormulaApi,
  content: string,
  options: {
    inputFormat: FormulaInputFormat;
    outputFormat: FormulaOutputFormat;
    mode?: FormulaConversionMode;
  },
): ApiEnvelopeV3<FormulaConversionResult> {
  return api.convert_formula_v3(
    content, options.inputFormat, options.outputFormat, options.mode ?? "strict",
  );
}
