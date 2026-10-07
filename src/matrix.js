import * as obsidian from "obsidian";
import { log, ui } from "./core.js";
import { writeClipboard } from "./custom-library.js";
import { renderLatexInto } from "./parameters.js";

// ==================== Matrix data paste ====================
// Pasted spreadsheet data becomes a LaTeX matrix or an aligned equation.
const MATRIX_ENVIRONMENTS = ["bmatrix", "pmatrix", "matrix", "vmatrix", "Vmatrix", "array", "cases", "aligned"];
const MATRIX_ENVIRONMENT_KEYS = {
  bmatrix: "matrixEnvBmatrix",
  pmatrix: "matrixEnvPmatrix",
  matrix: "matrixEnvMatrix",
  vmatrix: "matrixEnvVmatrix",
  Vmatrix: "matrixEnvVmatrixBig",
  array: "matrixEnvArray",
  cases: "matrixEnvCases",
  aligned: "matrixEnvAligned",
};
const MATRIX_DELIMITER_KEYS = {
  auto: "matrixDelimAuto",
  tab: "matrixDelimTab",
  comma: "matrixDelimComma",
  semicolon: "matrixDelimSemicolon",
  pipe: "matrixDelimPipe",
  space: "matrixDelimSpace",
};

function matrixEnvironmentLabel(plugin, id) {
  const key = MATRIX_ENVIRONMENT_KEYS[id];
  return key ? ui(plugin, key) : id;
}

function matrixDelimiterLabel(plugin, id) {
  const key = MATRIX_DELIMITER_KEYS[id];
  return key ? ui(plugin, key) : id;
}

function matrixDelimiterChar(id) {
  if (id === "comma") return ",";
  if (id === "semicolon") return ";";
  if (id === "pipe") return "|";
  if (id === "space") return " ";
  return "\t";
}

// Picks the separator that splits every data line into the same number of cells.
function detectMatrixDelimiter(text) {
  const raw = String(text == null ? "" : text);
  if (raw.indexOf("\t") >= 0) return "tab";
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").filter(function(line) { return line.trim() !== ""; });
  if (!lines.length) return "space";
  const consistent = function(ch) {
    const counts = lines.map(function(line) { return line.split(ch).length - 1; });
    return counts[0] > 0 && counts.every(function(n) { return n === counts[0]; });
  };
  if (consistent(",")) return "comma";
  if (consistent(";")) return "semicolon";
  if (consistent("|")) return "pipe";
  return "space";
}

function withGridShape(rows, delimiter) {
  const clean = (rows || []).map(function(row) {
    return (row || []).map(function(cell) { return String(cell == null ? "" : cell); });
  });
  let width = 0;
  clean.forEach(function(row) { width = Math.max(width, row.length); });
  clean.forEach(function(row) { while (row.length < width) row.push(""); });
  return { rows: clean, width: width, height: clean.length, delimiter: delimiter || "auto" };
}

function parseMatrixGrid(text, delimiter) {
  const raw = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  const mode = !delimiter || delimiter === "auto" ? detectMatrixDelimiter(raw) : delimiter;
  const separator = matrixDelimiterChar(mode);
  const lines = raw.split("\n").filter(function(line) { return line.trim() !== "" || line.includes(separator); });
  const rows = lines.map(function(line) {
    let cells;
    if (mode === "tab") cells = line.split("\t");
    else if (mode === "comma") cells = line.split(",");
    else if (mode === "semicolon") cells = line.split(";");
    else if (mode === "pipe") cells = line.split("|");
    else if (mode === "space") cells = line.trim().split(/\s+/);
    else cells = [line];
    const trimmed = cells.map(function(cell) { return cell.trim(); });
    return trimmed;
  });
  return withGridShape(rows, mode);
}

function transposeMatrixGrid(grid) {
  const rows = (grid && grid.rows) || [];
  const columns = [];
  for (let c = 0; c < (grid.width || 0); c++) {
    columns.push(rows.map(function(row) { return row[c] == null ? "" : row[c]; }));
  }
  return withGridShape(columns.length ? columns : [[]], grid.delimiter);
}

function addMatrixRow(grid) {
  const rows = ((grid && grid.rows) || []).map(function(row) { return row.slice(); });
  const width = Math.max(1, (grid && grid.width) || 1);
  rows.push(new Array(width).fill(""));
  return withGridShape(rows, grid.delimiter);
}

function removeMatrixRow(grid) {
  const rows = ((grid && grid.rows) || []).map(function(row) { return row.slice(); });
  if (rows.length > 1) rows.pop();
  else rows.splice(0, rows.length, new Array(Math.max(1, (grid && grid.width) || 1)).fill(""));
  return withGridShape(rows, grid.delimiter);
}

function addMatrixColumn(grid) {
  const rows = ((grid && grid.rows) || []).map(function(row) { return row.concat([""]); });
  if (!rows.length) rows.push([""]);
  return withGridShape(rows, grid.delimiter);
}

function removeMatrixColumn(grid) {
  const width = Math.max(1, (grid && grid.width) || 1);
  const rows = ((grid && grid.rows) || []).map(function(row) {
    return width <= 1 ? [""] : row.slice(0, width - 1);
  });
  if (!rows.length) rows.push([""]);
  return withGridShape(rows, grid.delimiter);
}

// Only labelled cells become \text{...}: text containing non-ASCII letters or
// spaces is prose, while numbers, ASCII variables, and existing LaTeX stay as-is.
function formatMatrixCell(value, wrapText) {
  const text = String(value == null ? "" : value).trim();
  if (!text || !wrapText) return text;
  if (text.indexOf("\\") >= 0 || text.indexOf("$") >= 0 || text.indexOf("{") >= 0) return text;
  const labelled = (/[^\x00-\x7F]/.test(text) && /\p{L}/u.test(text)) || /\s/.test(text);
  return labelled ? "\\text{" + text + "}" : text;
}

function buildMatrixLatex(grid, options) {
  const settings = options || {};
  const env = MATRIX_ENVIRONMENTS.indexOf(settings.environment) >= 0 ? settings.environment : "bmatrix";
  const rows = (grid && grid.rows) || [];
  if (!rows.length || !grid.width) return "";
  const body = rows.map(function(row) {
    const cells = row.map(function(cell) { return formatMatrixCell(cell, settings.wrapText); });
    if (env === "aligned" && cells.length === 2) return cells[0] + " & = " + cells[1];
    return cells.join(" & ");
  }).join(" \\\\ ");
  if (env === "array") {
    const spec = "c".repeat(Math.max(1, grid.width));
    return "\\left[\\begin{array}{" + spec + "} " + body + " \\end{array}\\right]";
  }
  if (env === "aligned") return "\\begin{aligned} " + body + " \\end{aligned}";
  return "\\begin{" + env + "} " + body + " \\end{" + env + "}";
}

function matrixSizeText(plugin, grid) {
  const template = ui(plugin, "matrixSize");
  const rows = grid && grid.height ? grid.height : 0;
  const columns = grid && grid.width ? grid.width : 0;
  return template.replace("{r}", String(rows)).replace("{c}", String(columns));
}

function matrixGridToText(grid, delimiterId) {
  const char = matrixDelimiterChar(delimiterId);
  return ((grid && grid.rows) || []).map(function(row) { return row.join(char); }).join("\n");
}

class MatrixPasteModal extends obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.grid = withGridShape([[]], "auto");
  }

  onOpen() {
    this.containerEl.addClass("formula-library-modal-container");
    this.modalEl.addClass("formula-library-modal");
    this.modalEl.addClass("formula-matrix-modal");
    this.contentEl.addClass("ft-modal");
    const p = this.plugin;
    this.titleEl.setText(ui(p, "matrixPasteTitle"));
    this.contentEl.createDiv({ cls: "fl-manage-file", text: ui(p, "matrixPasteDesc") });
    const body = this.contentEl.createDiv({ cls: "ft-body" });

    this.textarea = body.createEl("textarea", {
      cls: "mt-input",
      attr: { placeholder: ui(p, "matrixPastePlaceholder"), rows: "6", spellcheck: "false", "aria-label": ui(p, "matrixPasteTitle") },
    });

    const controls = body.createDiv({ cls: "mt-controls" });
    this.envSelect = controls.createEl("select", { cls: "ft-select" });
    MATRIX_ENVIRONMENTS.forEach((id) => {
      this.envSelect.createEl("option", { value: id, text: matrixEnvironmentLabel(p, id) });
    });
    this.envSelect.value = "bmatrix";
    this.envSelect.setAttribute("aria-label", ui(p, "matrixEnv"));
    this.envSelect.addEventListener("change", () => this.refresh());

    const envLabel = controls.createEl("label", { cls: "fl-control-field" });
    envLabel.createSpan({ text: ui(p, "matrixEnv") });
    envLabel.appendChild(this.envSelect);

    this.delimSelect = controls.createEl("select", { cls: "ft-select" });
    Object.keys(MATRIX_DELIMITER_KEYS).forEach((id) => {
      this.delimSelect.createEl("option", { value: id, text: matrixDelimiterLabel(p, id) });
    });
    this.delimSelect.value = "auto";
    this.delimSelect.setAttribute("aria-label", ui(p, "matrixDelim"));
    this.delimSelect.addEventListener("change", () => this.refresh());
    const delimLabel = controls.createEl("label", { cls: "fl-control-field" });
    delimLabel.createSpan({ text: ui(p, "matrixDelim") });
    delimLabel.appendChild(this.delimSelect);

    const wrapLabel = controls.createEl("label", { cls: "mt-check" });
    this.wrapText = wrapLabel.createEl("input", { attr: { type: "checkbox" } });
    wrapLabel.createEl("span", { text: ui(p, "matrixWrapText") });
    this.wrapText.addEventListener("change", () => this.refresh());

    const gridBar = body.createDiv({ cls: "fl-manage-bar" });
    const addButton = (key, handler) => {
      const button = gridBar.createEl("button", { cls: "fe-btn", text: ui(p, key) });
      button.addEventListener("click", handler);
      return button;
    };
    addButton("matrixTranspose", () => this.applyGrid(transposeMatrixGrid(this.grid)));
    addButton("matrixAddRow", () => this.applyGrid(addMatrixRow(this.grid)));
    addButton("matrixRemoveRow", () => this.applyGrid(removeMatrixRow(this.grid)));
    addButton("matrixAddColumn", () => this.applyGrid(addMatrixColumn(this.grid)));
    addButton("matrixRemoveColumn", () => this.applyGrid(removeMatrixColumn(this.grid)));

    const wrap = body.createDiv({ cls: "ft-preview-wrap" });
    this.previewEl = wrap.createDiv({ cls: "ft-preview" });

    const footer = this.contentEl.createDiv({ cls: "ft-footer" });
    this.statusEl = footer.createDiv({ cls: "ft-status", text: ui(p, "matrixEmpty") });
    const actions = footer.createDiv({ cls: "ft-actions" });
    if (typeof this.options.onInsert === "function") {
      const useButton = actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(p, "paramUseInEditor") });
      useButton.addEventListener("click", () => this.insert(true));
    }
    const insertButton = actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(p, "paramInsert") });
    insertButton.addEventListener("click", () => this.insert(false));
    const copyButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "matrixCopy") });
    copyButton.addEventListener("click", () => this.copy());
    const cancelButton = actions.createEl("button", { cls: "fe-btn", text: ui(p, "cancel") });
    cancelButton.addEventListener("click", () => this.close());

    this.textarea.addEventListener("input", () => this.refresh());
    this.refresh();
    window.setTimeout(() => { if (this.textarea && this.textarea.focus) this.textarea.focus(); }, 0);
  }

  currentLatex() {
    return buildMatrixLatex(this.grid, {
      environment: this.envSelect ? this.envSelect.value : "bmatrix",
      wrapText: !!(this.wrapText && this.wrapText.checked),
    });
  }

  refresh() {
    this.grid = parseMatrixGrid(this.textarea.value, this.delimSelect ? this.delimSelect.value : "auto");
    const latex = this.currentLatex();
    if (this.statusEl) {
      this.statusEl.setText(this.grid.width ? matrixSizeText(this.plugin, this.grid) : ui(this.plugin, "matrixEmpty"));
    }
    renderLatexInto(this.previewEl, latex);
  }

  applyGrid(next) {
    this.grid = next;
    this.textarea.value = matrixGridToText(next, this.delimSelect ? this.delimSelect.value : "auto");
    // Preserve deliberately added empty rows/columns rather than reparsing them away.
    if (this.statusEl) this.statusEl.setText(matrixSizeText(this.plugin, next));
    renderLatexInto(this.previewEl, this.currentLatex());
  }

  insert(useInEditor) {
    const latex = this.currentLatex();
    if (!latex) {
      if (this.statusEl) this.statusEl.setText(ui(this.plugin, "matrixEmpty"));
      return;
    }
    log("Matrix paste insert:", this.grid.height + "x" + this.grid.width, this.envSelect.value);
    if (useInEditor && typeof this.options.onInsert === "function") this.options.onInsert(latex);
    else this.plugin.insertFormula(latex, true);
    this.close();
  }

  async copy() {
    const latex = this.currentLatex();
    if (!latex) {
      if (this.statusEl) this.statusEl.setText(ui(this.plugin, "matrixEmpty"));
      return;
    }
    const ok = await writeClipboard(latex);
    new obsidian.Notice(ui(this.plugin, ok ? "matrixCopied" : "exportCopyFailed"));
    if (this.statusEl) this.statusEl.setText(ui(this.plugin, ok ? "matrixCopied" : "exportCopyFailed"));
  }
}

export { MATRIX_ENVIRONMENTS, MATRIX_ENVIRONMENT_KEYS, MATRIX_DELIMITER_KEYS, matrixEnvironmentLabel, matrixDelimiterLabel, matrixDelimiterChar, detectMatrixDelimiter, withGridShape, parseMatrixGrid, transposeMatrixGrid, addMatrixRow, removeMatrixRow, addMatrixColumn, removeMatrixColumn, formatMatrixCell, buildMatrixLatex, matrixSizeText, matrixGridToText, MatrixPasteModal };
