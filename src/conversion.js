import * as obsidian from "obsidian";
import { loc } from "./core.js";
import { findConversionRoute } from "./core-conversion.js";
import { renderLatexInto } from "./parameters.js";
import { writeClipboard } from "./custom-library.js";

const STRINGS = {
  en: {
    title: "Convert a formula", intro: "Convert one formula locally. The original stays unchanged until you explicitly use the result.",
    inputFormat: "Source format", outputFormat: "Output format", mode: "Conversion mode", source: "Original source", output: "Converted output",
    sourceHint: "Paste a single formula, not a complete document. XML is treated as text.", outputHint: "Review this text before copying or using it. Conversion does not guarantee identical appearance.",
    fragment: "LaTeX fragment", strict: "Strict", bestEffort: "Best-effort",
    strictHint: "Strict supports only the accepted LaTeX → OMML subset. Other routes are unavailable in this mode; a failure never silently switches to Best-effort.",
    unavailable: "unavailable", routeUnavailable: "This source, output and mode are not supported by the installed Core.",
    bestEffortHint: "Best-effort can lose syntax or style and does not recover the original author source. Inspect the output before use.",
    convert: "Convert", cancelTask: "Cancel task", retry: "Retry engine", copy: "Copy output", use: "Use in current editor", openEditor: "Open in formula editor", close: "Close",
    loading: "Loading the local conversion engine…", ready: "Engine ready. Choose a route and convert explicitly.", converting: "Converting… You can cancel; your original source is kept.",
    empty: "A confirmed conversion will appear here.", changed: "Source or options changed. Convert again before using the output.", cancelled: "Task cancelled. Your original source was kept.",
    converted: "Conversion finished. Review the output and diagnostics before using it.", preview: "Formula preview", previewHint: "The preview uses Obsidian MathJax; renderer support is separate from Core conversion support.",
    previewFailed: "The text was converted, but the formula preview is unavailable or contains an error. You can inspect or copy the text; using it in the editor is disabled.",
    diagnostics: "Diagnostics and limitations", copied: "Output copied.", copyFailed: "Clipboard write failed. You can select the output and copy it manually.", noEditor: "No active formula editor could be opened. The converted output is still here.",
    editorChanged: "The formula editor changed or closed. Reopen conversion before using this result; the output can still be copied.",
    inputLarge: "The input exceeds the 64 KiB UTF-8 limit. Shorten the formula; the original is kept.", outputLarge: "The result exceeds the output limit. The original is kept.",
    timeout: "The task exceeded its total waiting/execution deadline. The original is kept; retry explicitly if needed.", queueFull: "The conversion queue is full. Try again after another task finishes.",
    invalid: "The engine returned an invalid or mismatched result. It will not be used in the editor.", backendFailed: "The local conversion engine is unavailable. Existing LaTeX editing is unaffected; you can retry.",
    conversionFailed: "The formula could not be converted. Review the diagnostics and source; nothing was replaced.",
    reconstruction: "Reconstructed LaTeX is not the original author source.", lossy: "Unsupported syntax or style may be lost.", roundtrip: "Complete round-trip fidelity is not guaranteed.",
    strictParity: "Strict source validation does not guarantee identical appearance or lossless conversion.", strictMacros: "Custom macros and unsupported environments are rejected.",
    ommlHint: "OMML output is XML for exchange with an Office adapter, not an OLE object or a guaranteed editable Word paste.",
  },
  zh: {
    title: "转换单个公式", intro: "在本地转换一个公式。只有明确使用结果时才会填入编辑器，原始内容不会自动更改。",
    inputFormat: "来源格式", outputFormat: "输出格式", mode: "转换模式", source: "原始内容", output: "转换结果",
    sourceHint: "粘贴单个公式，不是完整文档。XML 仅作为文本处理。", outputHint: "复制或使用前请检查文本。转换不保证外观完全一致。",
    fragment: "LaTeX（裸公式）", strict: "严格", bestEffort: "尽力转换",
    strictHint: "严格模式仅支持有限的 LaTeX → OMML 子集。其他路线在此模式下不可用，失败不会悄悄切换为尽力转换。",
    unavailable: "不可用", routeUnavailable: "当前 Core 不支持这一来源、输出和模式的组合。",
    bestEffortHint: "尽力转换可能丢失语法或样式，不能恢复作者原始源码。请检查结果后再使用。",
    convert: "转换", cancelTask: "取消任务", retry: "重试引擎", copy: "复制结果", use: "填入当前编辑器", openEditor: "打开公式编辑器", close: "关闭",
    loading: "正在加载本地转换引擎…", ready: "引擎已就绪。选择路线后手动转换。", converting: "正在转换…可以取消，原始内容会保留。",
    empty: "确认转换后，结果会显示在这里。", changed: "原文或选项已更改，请重新转换后再使用结果。", cancelled: "任务已取消，原始内容已保留。",
    converted: "转换完成。请检查结果和诊断后再使用。", preview: "公式预览", previewHint: "预览使用 Obsidian MathJax；渲染支持与 Core 转换支持是不同边界。",
    previewFailed: "文本已转换，但公式预览为空或有错误。可检查或复制文本，暂不允许填入编辑器。",
    diagnostics: "诊断与限制", copied: "已复制结果。", copyFailed: "写入剪贴板失败，可选中结果手动复制。", noEditor: "未能打开公式编辑器，转换结果仍保留在此处。",
    editorChanged: "公式编辑器已改变或关闭，请重新打开转换后再使用；当前结果仍可复制。",
    inputLarge: "输入超过 64 KiB UTF-8 限制，请缩短公式，原始内容已保留。", outputLarge: "结果超过输出限制，原始内容已保留。",
    timeout: "排队与执行总等待时间已超限，原始内容已保留；如需重试请手动操作。", queueFull: "转换队列已满，请等待其他任务完成后重试。",
    invalid: "引擎返回的结果无效或与请求不匹配，不会填入编辑器。", backendFailed: "本地转换引擎不可用，现有 LaTeX 编辑不受影响，可以重试。",
    conversionFailed: "公式无法转换，请检查诊断与原文，未替换任何内容。",
    reconstruction: "重建的 LaTeX 不是作者原始源码。", lossy: "不支持的语法或样式可能丢失。", roundtrip: "不保证完整的往返保真。",
    strictParity: "严格源码验证不保证外观一致或无损转换。", strictMacros: "自定义宏和不支持的环境会被拒绝。",
    ommlHint: "OMML 是供 Office 适配器交换的 XML，不是 OLE 对象，也不保证普通粘贴即可得到可编辑 Word 公式。",
  },
};
const SOURCE_FORMATS = ["latex", "typst", "mathml", "omml"];
const TARGET_FORMATS = ["latex-fragment", "typst", "mathml", "omml"];
const FORMAT_LABELS = { latex: "LaTeX", typst: "Typst", mathml: "MathML", omml: "OMML" };
const LIMITATION_KEYS = {
  "accepted-input-may-lose-unsupported-syntax-or-style": "lossy",
  "reconstructed-latex-is-not-the-original-author-source": "reconstruction",
  "no-complete-round-trip-guarantee": "roundtrip",
  "source-validation-is-not-a-lossless-or-visual-parity-guarantee": "strictParity",
  "custom-macros-and-unsupported-environments-are-rejected": "strictMacros",
};
let modalSequence = 0;

export class FormulaConversionModal extends obsidian.Modal {
  constructor(app, plugin, options = {}) {
    super(app);
    this.plugin = plugin;
    this.options = options;
    this.originalSource = typeof options.source === "string" ? options.source : "";
    this._streamKey = `formula-conversion-modal:${++modalSequence}`;
    this._revision = 0;
    this._loadRevision = 0;
    this._texts = [];
    this._result = null;
    this._closed = true;
    this._previewReady = false;
  }

  text(key) { return (STRINGS[loc(this.plugin)] || STRINGS.en)[key] || STRINGS.en[key] || key; }

  caption(el, key) {
    this._texts.push([el, key]);
    el.setText(this.text(key));
    return el;
  }

  onOpen() {
    this._closed = false;
    this._texts = [];
    this.containerEl.addClass("formula-library-modal-container");
    this.modalEl.addClass("formula-library-modal");
    this.modalEl.addClass("formula-conversion-modal");
    this.contentEl.addClass("fc-modal");
    this.caption(this.titleEl, "title");
    if (!this.plugin._conversionModals) this.plugin._conversionModals = new Set();
    this.plugin._conversionModals.add(this);

    this.caption(this.contentEl.createEl("p", { cls: "fc-intro" }), "intro");
    const body = this.contentEl.createDiv({ cls: "fc-body" });
    const controls = body.createDiv({ cls: "fc-controls" });
    const select = (key) => {
      const field = controls.createEl("label", { cls: "fc-field" });
      this.caption(field.createSpan(), key);
      const control = field.createEl("select", { attr: { "aria-label": this.text(key) } });
      control.addEventListener("change", () => this.sourceChanged());
      return control;
    };
    this.inputSelect = select("inputFormat");
    SOURCE_FORMATS.forEach((id) => this.inputSelect.createEl("option", { value: id, text: FORMAT_LABELS[id] }));
    this.inputSelect.value = SOURCE_FORMATS.includes(this.options.inputFormat) ? this.options.inputFormat : "latex";
    this.outputSelect = select("outputFormat");
    TARGET_FORMATS.forEach((id) => this.outputSelect.createEl("option", { value: id, text: id }));
    this.outputSelect.value = "latex-fragment";
    this.modeSelect = select("mode");
    this.modeSelect.createEl("option", { value: "strict" });
    this.modeSelect.createEl("option", { value: "best-effort" });
    this.modeSelect.value = "best-effort";
    this.routeHint = body.createDiv({ cls: "fc-route-hint" });
    this.engineInfo = body.createDiv({ cls: "fc-helper" });

    const workspace = body.createDiv({ cls: "fc-workspace" });
    const source = workspace.createDiv({ cls: "fc-source-pane" });
    const sourceField = source.createEl("label", { cls: "fc-field" });
    this.caption(sourceField.createSpan(), "source");
    this.sourceInput = sourceField.createEl("textarea", { cls: "fc-source", attr: { spellcheck: "false", "aria-label": this.text("source") } });
    this.sourceInput.value = this.originalSource;
    this.sourceInput.addEventListener("input", () => this.sourceChanged());
    this.caption(source.createDiv({ cls: "fc-helper" }), "sourceHint");

    const destination = workspace.createDiv({ cls: "fc-output-pane" });
    const resultField = destination.createEl("label", { cls: "fc-field" });
    this.caption(resultField.createSpan(), "output");
    this.outputInput = resultField.createEl("textarea", { cls: "fc-output", attr: { readonly: "true", spellcheck: "false", "aria-label": this.text("output") } });
    this.outputInput.readOnly = true;
    this.outputInput.placeholder = this.text("empty");
    this.caption(destination.createDiv({ cls: "fc-helper" }), "outputHint");
    this.previewWrap = destination.createDiv({ cls: "fc-preview-section" });
    this.caption(this.previewWrap.createDiv({ cls: "fc-label" }), "preview");
    const previewScroll = this.previewWrap.createDiv({ cls: "fc-preview-scroll" });
    this.previewEl = previewScroll.createDiv({ cls: "fc-preview" });
    this.caption(this.previewWrap.createDiv({ cls: "fc-helper" }), "previewHint");
    this.previewWrap.hidden = true;
    this.diagnosticsWrap = body.createDiv({ cls: "fc-diagnostics-section" });
    this.caption(this.diagnosticsWrap.createDiv({ cls: "fc-label" }), "diagnostics");
    this.diagnosticsEl = this.diagnosticsWrap.createEl("ul", { cls: "fc-diagnostics" });
    this.diagnosticsWrap.hidden = true;

    const footer = this.contentEl.createDiv({ cls: "fc-footer" });
    this.statusEl = footer.createDiv({ cls: "fc-status", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
    const taskActions = footer.createDiv({ cls: "fc-task-actions" });
    const button = (parent, key, fn, primary = false) => {
      const el = this.caption(parent.createEl("button", { cls: `fe-btn${primary ? " fe-btn-primary" : ""}`, attr: { type: "button" } }), key);
      el.addEventListener("click", fn);
      return el;
    };
    this.convertButton = button(taskActions, "convert", () => this.convert(), true);
    this.cancelButton = button(taskActions, "cancelTask", () => this.cancelTask());
    this.retryButton = button(taskActions, "retry", () => this.loadCapabilities());
    const outputActions = footer.createDiv({ cls: "fc-output-actions" });
    this.copyButton = button(outputActions, "copy", () => this.copyOutput());
    this.useButton = button(outputActions, this.options.onInsert ? "use" : "openEditor", () => this.useOutput());
    button(outputActions, "close", () => this.close());
    this.refreshLocalization();
    this.loadCapabilities();
  }

  snapshot() {
    return { content: this.sourceInput.value, inputFormat: this.inputSelect.value,
      outputFormat: this.outputSelect.value, mode: this.modeSelect.value };
  }

  matches(snapshot) {
    if (this._closed || !snapshot) return false;
    const current = this.snapshot();
    return Object.keys(current).every((key) => current[key] === snapshot[key]);
  }

  setStatus(key, state = "normal", code = "") {
    if (this._closed) return;
    this._status = { key, state, code };
    this.statusEl.setText(this.text(key) + (code ? ` [${String(code).slice(0, 100)}]` : ""));
    this.statusEl.dataset.state = state;
    this.statusEl.setAttribute("role", state === "error" ? "alert" : "status");
  }

  showError(error) {
    const code = error?.code || error?.detail?.code || "CORE_UNAVAILABLE";
    const key = ({ INPUT_TOO_LARGE: "inputLarge", OUTPUT_TOO_LARGE: "outputLarge", CORE_TIMEOUT: "timeout",
      WORKER_TASK_TIMEOUT: "timeout", CORE_QUEUE_FULL: "queueFull", WORKER_QUEUE_FULL: "queueFull",
      INVALID_CORE_RESPONSE: "invalid", CONVERSION_FAILED: "conversionFailed", INVALID_ARGUMENT: "conversionFailed",
      UNSUPPORTED_FORMAT: "routeUnavailable", CANCELLED: "cancelled", SUPERSEDED: "changed" })[code] || "backendFailed";
    this.setStatus(key, key === "cancelled" || key === "changed" ? "normal" : "error", code);
  }

  clearOutput() {
    this._result = null;
    this._resultSnapshot = null;
    this._previewReady = false;
    this.outputInput.value = "";
    this.previewEl.empty();
    this.previewWrap.hidden = true;
    this.diagnosticsEl.empty();
    this.diagnosticsWrap.hidden = true;
  }

  sourceChanged() {
    this._revision += 1;
    this._conversionController?.abort();
    this._conversionController = null;
    this._busy = false;
    this.clearOutput();
    this.setStatus("changed");
    this.syncControls();
  }

  async loadCapabilities() {
    if (this._closed || this._applying) return;
    this.sourceChanged();
    this._loadController?.abort();
    const controller = this._loadController = new AbortController();
    const token = ++this._loadRevision;
    this._loading = true;
    this._capabilities = null;
    this.engineInfo.setText("");
    this.setStatus("loading");
    this.syncControls();
    try {
      this.service = await this.plugin.getCoreConversionService();
      if (this._closed || token !== this._loadRevision || controller.signal.aborted) return;
      const envelope = await this.service.getCapabilities({ signal: controller.signal });
      if (this._closed || token !== this._loadRevision || controller.signal.aborted) return;
      this._capabilities = envelope;
      if (!envelope.ok) {
        this.showError(envelope.error);
        this.showDiagnostics(envelope);
      } else {
        this.engineInfo.setText(`Core ${envelope.versions.coreVersion} · API v${envelope.versions.apiEnvelopeVersion}`);
        this.setStatus("ready");
      }
    } catch (error) {
      if (!this._closed && token === this._loadRevision && !controller.signal.aborted) this.showError(error);
    } finally {
      if (!this._closed && token === this._loadRevision) {
        this._loading = false;
        this._loadController = null;
        this.syncControls();
      }
    }
  }

  syncControls() {
    if (this._closed) return;
    const snapshot = this.snapshot();
    for (const option of this.outputSelect.options) {
      const route = this._capabilities?.ok ? findConversionRoute(this._capabilities, { ...snapshot, outputFormat: option.value }) : null;
      const label = option.value === "latex-fragment" ? this.text("fragment") : FORMAT_LABELS[option.value];
      option.textContent = label + (this._capabilities?.ok && !route?.available ? ` · ${this.text("unavailable")}` : "");
      option.disabled = !!this._capabilities?.ok && !route?.available;
    }
    const route = this._capabilities?.ok ? findConversionRoute(this._capabilities, snapshot) : null;
    this.routeHint.setText(snapshot.mode === "strict" ? this.text("strictHint") : this.text("bestEffortHint"));
    if (snapshot.outputFormat === "omml") this.routeHint.setText(this.routeHint.textContent + " " + this.text("ommlHint"));
    if (this._capabilities?.ok && !route?.available) this.routeHint.setText(this.routeHint.textContent + " " + this.text("routeUnavailable"));
    this.convertButton.disabled = !!(this._loading || this._busy || this._applying || !route?.available || !snapshot.content.trim());
    this.cancelButton.disabled = !(this._loading || this._busy);
    this.retryButton.disabled = !!(this._loading || this._busy || this._applying);
    const current = this._result?.ok && this.matches(this._resultSnapshot);
    this.copyButton.disabled = !!(!current || this._busy || this._applying);
    this.useButton.disabled = !!(!current || this._busy || this._applying || !this._previewReady || snapshot.outputFormat !== "latex-fragment");
    for (const control of [this.inputSelect, this.outputSelect, this.modeSelect, this.sourceInput]) control.disabled = !!this._applying;
    this.contentEl.setAttribute("aria-busy", String(!!(this._loading || this._busy || this._applying)));
  }

  async convert() {
    if (this._closed || this.convertButton.disabled) return;
    this.clearOutput();
    const snapshot = this.snapshot();
    const revision = ++this._revision;
    const controller = this._conversionController = new AbortController();
    this._busy = true;
    this.setStatus("converting");
    this.syncControls();
    try {
      const envelope = await this.service.convert(snapshot, { signal: controller.signal, supersedeKey: this._streamKey });
      if (!this.matches(snapshot) || revision !== this._revision || controller.signal.aborted) return;
      if (!envelope.ok) {
        this.showError(envelope.error);
        this.showDiagnostics(envelope);
        return;
      }
      this._result = envelope;
      this._resultSnapshot = snapshot;
      this.outputInput.value = envelope.data.content;
      this.showDiagnostics(envelope);
      if (snapshot.outputFormat === "latex-fragment") {
        this.previewWrap.hidden = false;
        renderLatexInto(this.previewEl, envelope.data.content);
        try {
          if (typeof obsidian.finishRenderMath === "function") await obsidian.finishRenderMath();
          if (!this.matches(snapshot) || revision !== this._revision || controller.signal.aborted) return;
          const child = this.previewEl.firstElementChild;
          const bounds = child?.getBoundingClientRect();
          this._previewReady = !!child && bounds.width > 0 && bounds.height > 0
            && !this.previewEl.querySelector("[data-mjx-error], [data-mml-node='merror'], .mjx-merror, .MathJax_Error, mjx-merror, merror");
        } catch {
          if (!this.matches(snapshot) || revision !== this._revision || controller.signal.aborted) return;
          this._previewReady = false;
        }
        this.setStatus(this._previewReady ? "converted" : "previewFailed", this._previewReady ? "normal" : "warning");
      } else this.setStatus("converted");
    } catch (error) {
      if (!this._closed && revision === this._revision && !controller.signal.aborted) this.showError(error);
    } finally {
      if (!this._closed && revision === this._revision) {
        this._busy = false;
        this._conversionController = null;
        this.syncControls();
      }
    }
  }

  showDiagnostics(envelope) {
    this.diagnosticsEl.empty();
    const entries = [];
    for (const diagnostic of envelope.diagnostics || []) {
      const code = diagnostic.code || diagnostic.stage || "";
      entries.push([code, diagnostic.message].filter(Boolean).join(": ").slice(0, 2048));
    }
    for (const limitation of envelope.data?.capability?.limitations || []) {
      entries.push(LIMITATION_KEYS[limitation] ? this.text(LIMITATION_KEYS[limitation]) : String(limitation).slice(0, 512));
    }
    if (envelope.error?.details) {
      try { entries.push(JSON.stringify(envelope.error.details).slice(0, 2048)); } catch { /* Preserve source even for malformed diagnostic data. */ }
    }
    [...new Set(entries.filter(Boolean))].forEach((text) => this.diagnosticsEl.createEl("li", { text }));
    this.diagnosticsWrap.hidden = this.diagnosticsEl.children.length === 0;
  }

  cancelTask() {
    this._revision += 1;
    this._loadRevision += 1;
    this._conversionController?.abort();
    this._loadController?.abort();
    this._conversionController = this._loadController = null;
    this._busy = this._loading = false;
    this.clearOutput();
    this.setStatus("cancelled");
    this.syncControls();
  }

  async copyOutput() {
    if (this._closed || this.copyButton.disabled || !this.matches(this._resultSnapshot)) return;
    const result = this._result;
    const copied = await writeClipboard(result.data.content);
    if (!this._closed && this._result === result) this.setStatus(copied ? "copied" : "copyFailed", copied ? "normal" : "error");
  }

  async useOutput() {
    if (this._closed || this.useButton.disabled || !this.matches(this._resultSnapshot)) return;
    this._applying = true;
    this.syncControls();
    try {
      const fragment = this._result.data.content;
      if (typeof this.options.onInsert === "function") await this.options.onInsert(fragment);
      else if (!this.plugin.openEditor("insert", fragment)) {
        this.setStatus("noEditor", "error");
        return;
      }
      this.close();
    } catch (error) { this.setStatus(error?.code === "EDITOR_CHANGED" ? "editorChanged" : "noEditor", "error"); }
    finally { this._applying = false; this.syncControls(); }
  }

  refreshLocalization() {
    if (this._closed) return;
    this._texts.forEach(([el, key]) => el.setText(this.text(key)));
    for (const [control, key] of [[this.inputSelect, "inputFormat"], [this.outputSelect, "outputFormat"],
      [this.modeSelect, "mode"], [this.sourceInput, "source"], [this.outputInput, "output"]]) control.setAttribute("aria-label", this.text(key));
    this.modeSelect.options[0].textContent = this.text("strict");
    this.modeSelect.options[1].textContent = this.text("bestEffort");
    this.outputInput.placeholder = this.text("empty");
    if (this._result) this.showDiagnostics(this._result);
    if (this._status) this.setStatus(this._status.key, this._status.state, this._status.code);
    this.syncControls();
  }

  onClose() {
    this._closed = true;
    this._revision += 1;
    this._loadRevision += 1;
    this._conversionController?.abort();
    this._loadController?.abort();
    this._conversionController = this._loadController = null;
    this.plugin._conversionModals?.delete(this);
    this.contentEl.empty();
  }
}

export { FormulaConversionModal as CoreConversionModal };
