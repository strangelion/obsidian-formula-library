import * as obsidian from "obsidian";
import { runModalAction } from "./ui.js";
import { logWarn, ui, groupDisplayName, itemTags, itemNote, parseTagsInput, formatTags, withItemMeta, FORMULA_INDEX } from "./core.js";
import { customFolderFor, readCustomGroup, customGroupIdFromName, validateLatex, upsertCustomItem, createCustomGroup } from "./custom-library.js";
import { renderLatexInto } from "./parameters.js";

// ==================== Personal formula library ====================
// Saving from the editor: the formula goes into a custom category (created on
// demand) together with the name, tags and note the table cannot hold.
const PERSONAL_FOLDER_FALLBACK = "my-formulas";

// Where personal saves land: the configured custom folder, or the default one
// when the user has not pointed the plugin at a folder yet.
function personalFolderFor(plugin) {
  return customFolderFor(plugin) || PERSONAL_FOLDER_FALLBACK;
}

// A first save from the editor must not silently write into the vault root, so
// the fallback folder is persisted as the custom library path.
async function adoptPersonalFolder(plugin) {
  if (customFolderFor(plugin)) return;
  plugin.settings.customFormulasPath = PERSONAL_FOLDER_FALLBACK;
  FORMULA_INDEX.customFolder = PERSONAL_FOLDER_FALLBACK;
  await plugin.saveSettings();
}

async function ensurePersonalGroup(plugin, meta, newName) {
  await adoptPersonalFolder(plugin);
  const name = String(newName == null ? "" : newName).trim();
  if (name) {
    const id = customGroupIdFromName(name) || "formulas-" + Date.now().toString(36);
    const existing = FORMULA_INDEX.custom.find(function(entry) { return entry.id === id; });
    if (existing) return existing;
    await createCustomGroup(plugin, id, name);
    await plugin.reloadFormulas();
    return FORMULA_INDEX.custom.find(function(entry) { return entry.id === id; }) || { id: id, file: id + ".json", count: 0 };
  }
  if (meta) return meta;
  // No category chosen: reuse the first personal one, so a programmatic save
  // does not scatter categories. Only an empty library gets a new category.
  if (FORMULA_INDEX.custom.length) return FORMULA_INDEX.custom[0];
  const fallbackId = "my-formulas";
  const fallbackGroup = FORMULA_INDEX.custom.find(function(entry) { return entry.id === fallbackId; });
  if (fallbackGroup) return fallbackGroup;
  await createCustomGroup(plugin, fallbackId, ui(plugin, "saveToLibraryDefaultGroup"));
  await plugin.reloadFormulas();
  return FORMULA_INDEX.custom.find(function(entry) { return entry.id === fallbackId; }) || { id: fallbackId, file: fallbackId + ".json", count: 0 };
}

// Existing LaTeX in the target category is updated in place, so saving the same
// formula twice behaves like "edit my entry" instead of piling up copies.
async function savePersonalFormula(plugin, latex, fields) {
  const meta = await ensurePersonalGroup(plugin, fields.meta, fields.newGroupName);
  const data = await readCustomGroup(plugin, meta);
  const index = data.items.findIndex(function(item) {
    return item && !item.section && String(item[1] == null ? "" : item[1]).trim() === latex;
  });
  const previous = index >= 0 ? data.items[index] : null;
  const entry = withItemMeta([fields.name, latex, previous && previous[2] ? previous[2] : ""], fields.tags, fields.note);
  await upsertCustomItem(plugin, meta, index, entry);
  await plugin.reloadFormulas();
  return { group: meta, updated: index >= 0 };
}

class SaveToLibraryModal extends obsidian.Modal {
  constructor(app, plugin, latex, options) {
    super(app);
    this.plugin = plugin;
    this.latex = String(latex == null ? "" : latex).trim();
    this.options = options || {};
  }
  onOpen() {
    const p = this.plugin;
    const groups = FORMULA_INDEX.custom.slice();
    this.titleEl.setText(ui(p, "saveToLibraryTitle"));
    this.modalEl.addClass("formula-custom-modal");
    this.contentEl.addClass("formula-custom-form");
    this.contentEl.createEl("p", { cls: "setting-item-description", text: ui(p, "saveToLibraryDesc") + " (" + personalFolderFor(p) + ")" });
    const field = (labelText, value, placeholder) => {
      const wrap = this.contentEl.createDiv({ cls: "fl-field" });
      wrap.createEl("label", { text: labelText });
      const input = wrap.createEl("input", { cls: "fl-field-input", attr: { type: "text", placeholder: placeholder || "" } });
      input.value = value || "";
      return input;
    };
    const previewWrap = this.contentEl.createDiv({ cls: "ft-preview-wrap" });
    renderLatexInto(previewWrap.createDiv({ cls: "ft-preview" }), this.latex);
    this.nameInput = field(ui(p, "itemName"), this.options.label || "", "e.g. My quadratic shortcut");
    this.tagsInput = field(ui(p, "itemTags"), "", ui(p, "itemTagsPlaceholder"));
    this.noteInput = field(ui(p, "itemNote"), "", ui(p, "itemNotePlaceholder"));
    // Typing wins over the prefill of an already saved formula.
    for (const input of [this.nameInput, this.tagsInput, this.noteInput]) {
      input.addEventListener("input", () => { this.touched = true; });
    }
    const groupWrap = this.contentEl.createDiv({ cls: "fl-field" });
    groupWrap.createEl("label", { text: ui(p, "saveToLibraryGroup") });
    this.groupSelect = groupWrap.createEl("select", { cls: "fl-field-input" });
    for (const meta of groups) this.groupSelect.createEl("option", { value: meta.id, text: groupDisplayName(p, meta.id) });
    if (!groups.length) this.groupSelect.createEl("option", { value: "", text: ui(p, "saveToLibraryDefaultGroup") });
    this.groupSelect.value = groups.length ? groups[0].id : "";
    this.groupSelect.addEventListener("change", () => { this.prefillFromExisting(); });
    this.newGroupInput = field(ui(p, "saveToLibraryNewGroup"), "", groups.length ? "" : ui(p, "saveToLibraryDefaultGroup"));
    this.contentEl.insertBefore(groupWrap, this.tagsInput.parentElement);
    this.contentEl.insertBefore(this.newGroupInput.parentElement, this.tagsInput.parentElement);
    this.errorEl = this.contentEl.createDiv({ cls: "fl-field-error" });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "save") }).addEventListener("click", () => runModalAction(this, () => this.save()));
    if (!this.latex) {
      this.errorEl.setText(ui(p, "saveToLibraryNoLatex"));
      return;
    }
    // Saving a formula that already sits in the category edits that entry.
    this.prefillFromExisting().catch((e) => logWarn("prefill failed", e));
  }

  async prefillFromExisting() {
    if (this.touched) return;
    const meta = FORMULA_INDEX.custom.find((entry) => entry.id === this.groupSelect.value);
    if (!meta) return;
    let data = null;
    try {
      data = await readCustomGroup(this.plugin, meta);
    } catch {
      return;
    }
    const match = (data.items || []).find((item) => {
      return item && !item.section && String(item[1] == null ? "" : item[1]).trim() === this.latex;
    });
    if (this.touched || this.groupSelect.value !== meta.id) return;
    if (!match) return;
    this.editing = true;
    this.nameInput.value = match[0] || "";
    this.tagsInput.value = formatTags(itemTags(match));
    this.noteInput.value = itemNote(match);
  }
  async save() {
    const p = this.plugin;
    if (!this.latex) { this.errorEl.setText(ui(p, "saveToLibraryNoLatex")); return; }
    const invalid = validateLatex(this.latex);
    if (invalid) { this.errorEl.setText(ui(p, invalid)); return; }
    const name = this.nameInput.value.trim();
    if (!name) { this.errorEl.setText(ui(p, "itemNameRequired")); return; }
    const newGroupName = this.newGroupInput.value.trim();
    const meta = newGroupName ? null : (FORMULA_INDEX.custom.find((entry) => entry.id === this.groupSelect.value) || null);
    const result = await savePersonalFormula(p, this.latex, {
      name: name,
      tags: parseTagsInput(this.tagsInput.value),
      note: this.noteInput.value,
      meta: meta,
      newGroupName: newGroupName,
    });
    new obsidian.Notice(ui(p, result.updated ? "saveToLibraryUpdated" : "saveToLibrarySaved"));
    if (this.options.onSaved) this.options.onSaved(result);
    this.close();
  }
}

export { PERSONAL_FOLDER_FALLBACK, personalFolderFor, adoptPersonalFolder, ensurePersonalGroup, savePersonalFormula, SaveToLibraryModal };
