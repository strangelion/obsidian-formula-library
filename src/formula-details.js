import * as obsidian from "obsidian";
import { loc, itemMeta, itemTags, itemNote, itemLabel, ui } from "./core.js";
import { labelControl } from "./ui.js";
import { renderLatexInto } from "./parameters.js";
import { SaveToLibraryModal } from "./personal-library.js";

const DETAIL_LABELS = { variables: ["变量含义", "Variables"], units: ["单位", "Units"], conditions: ["适用条件", "Conditions"], reference: ["来源", "Source / reference"] };

function createDetailFields(parent, plugin, metadata = {}) {
  const details = parent.createEl("details", { cls: "fl-formula-details-fields" });
  details.createEl("summary", { text: loc(plugin) === "zh" ? "变量、单位、条件与来源（可选）" : "Variables, units, conditions and source (optional)" });
  const inputs = {};
  for (const [key, labels] of Object.entries(DETAIL_LABELS)) {
    const input = details.createEl("textarea", { cls: "fl-field-input", attr: { rows: "2", maxlength: "5000" } });
    input.value = metadata?.[key] || "";
    labelControl(input, labels[loc(plugin) === "zh" ? 0 : 1]);
    inputs[key] = input;
  }
  return inputs;
}

const detailFieldValues = (inputs) => Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));

class FormulaDetailsModal extends obsidian.Modal {
  constructor(app, plugin, item) { super(app); this.plugin = plugin; this.item = item; }
  onOpen() {
    const p = this.plugin, item = this.item, t = (zh, en) => loc(p) === "zh" ? zh : en;
    this.modalEl.addClass("formula-custom-modal");
    this.titleEl.setText(itemLabel(p, item));
    const preview = this.contentEl.createDiv({ cls: "ft-preview-wrap" }).createDiv({ cls: "ft-preview" });
    if (!item[1].startsWith("matrix:")) renderLatexInto(preview, item[1].replace(/#\?/g, "\\square"));
    const source = this.contentEl.createEl("textarea", { cls: "fl-import-textarea", attr: { rows: "3", readonly: "true" } });
    source.value = item[1]; labelControl(source, "LaTeX");
    const tags = itemTags(item);
    if (tags.length) this.contentEl.createEl("p", { text: tags.map((tag) => "#" + tag).join(" ") });
    const meta = itemMeta(item) || {};
    let hasDetails = false;
    for (const [key, labels] of Object.entries({ note: ["说明", "Note"], ...DETAIL_LABELS })) {
      const value = key === "note" ? itemNote(item) : meta[key];
      if (!value) continue;
      hasDetails = true;
      this.contentEl.createEl("h3", { text: labels[loc(p) === "zh" ? 0 : 1] });
      this.contentEl.createEl("p", { text: value, cls: "fl-formula-detail-text" });
    }
    if (!hasDetails) this.contentEl.createEl("p", { text: t("尚无详细说明。保存到个人库后，可添加变量、单位、适用条件和来源；内置公式不会被修改。", "No details yet. Save to your personal library to add variables, units, conditions and sources; built-in entries remain unchanged.") });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    if (!item[1].startsWith("matrix:")) bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "saveToLibrary") }).addEventListener("click", () => new SaveToLibraryModal(this.app, p, item[1], { label: itemLabel(p, item), metadata: meta }).open());
    bar.createEl("button", { cls: "fl-btn", text: t("关闭", "Close") }).addEventListener("click", () => this.close());
  }
}

export { DETAIL_LABELS, createDetailFields, detailFieldValues, FormulaDetailsModal };
