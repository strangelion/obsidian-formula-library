import * as obsidian from "obsidian";
import { runModalAction } from "./ui.js";
import { FORMULA_DATA, UI_STRINGS, logWarn, loc, ui, groupDisplayName, itemLabel, itemMeta, itemTags, itemNote, parseTagsInput, formatTags, withItemMeta, FORMULA_INDEX, normalizeFolderPath } from "./core.js";

// ======================== Custom formula manager ========================
// The manager only ever writes to the user's own folder. Group files are read
// again right before a write so fields the manager does not know about
// (structures, extra keys) survive untouched.

function customFolderFor(plugin) {
  return normalizeFolderPath(plugin.settings.customFormulasPath);
}

function managerAdapter(plugin) {
  return plugin && plugin.app && plugin.app.vault ? plugin.app.vault.adapter : null;
}

function customIndexPath(plugin) { return customFolderFor(plugin) + "/_index.json"; }
function customStringsPath(plugin) { return customFolderFor(plugin) + "/_strings.json"; }
function customGroupPath(plugin, meta) { return customFolderFor(plugin) + "/" + (meta.file || meta.id + ".json"); }

async function ensureCustomFolder(plugin) {
  const adapter = managerAdapter(plugin);
  const folder = customFolderFor(plugin);
  if (!adapter || !folder) return null;
  if (folder.split("/").some((part) => part === "." || part === "..") || /^[a-z]:/i.test(folder)) {
    throw new Error(loc(plugin) === "zh" ? "请选择 Vault 内的相对文件夹路径" : "Use a folder path relative to the vault");
  }
  if (await adapter.exists(folder)) return adapter;
  const parts = folder.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? current + "/" + part : part;
    if (!(await adapter.exists(current))) await adapter.mkdir(current);
  }
  return adapter;
}

async function readCustomJson(plugin, path, fallback) {
  const adapter = managerAdapter(plugin);
  if (!adapter) return fallback;
  try {
    if (!(await adapter.exists(path))) return fallback;
    return JSON.parse(await adapter.read(path));
  } catch (e) {
    logWarn("custom manager read failed:", path, e.message);
    throw e;
  }
}

async function writeCustomJson(plugin, path, value) {
  const adapter = await ensureCustomFolder(plugin);
  if (!adapter) throw new Error("no vault adapter");
  await adapter.write(path, JSON.stringify(value, null, 2) + "\n");
}

async function readCustomGroup(plugin, meta) {
  const data = await readCustomJson(plugin, customGroupPath(plugin, meta), null);
  if (!data || typeof data !== "object") return { id: meta.id, structures: false, items: [] };
  if (!Array.isArray(data.items)) data.items = [];
  if (!data.id) data.id = meta.id;
  return data;
}

async function writeCustomGroup(plugin, meta, data) { await writeCustomJson(plugin, customGroupPath(plugin, meta), data); }

async function readCustomOrder(plugin) {
  const index = await readCustomJson(plugin, customIndexPath(plugin), null);
  const order = index && Array.isArray(index.order) ? index.order.filter(function(id) { return typeof id === "string" && id; }) : [];
  for (const meta of FORMULA_INDEX.custom) if (!order.includes(meta.id)) order.push(meta.id);
  return order;
}

async function writeCustomOrder(plugin, order) { await writeCustomJson(plugin, customIndexPath(plugin), { order: order }); }

// Custom tab names live in the custom _strings.json, next to the group files.
async function readCustomStrings(plugin) {
  const strings = await readCustomJson(plugin, customStringsPath(plugin), null);
  return strings && typeof strings === "object" ? strings : {};
}

async function writeCustomGroupName(plugin, id, name) {
  const strings = await readCustomStrings(plugin);
  strings.en = strings.en && typeof strings.en === "object" ? strings.en : {};
  strings.zh = strings.zh && typeof strings.zh === "object" ? strings.zh : {};
  strings.en.tabs = strings.en.tabs && typeof strings.en.tabs === "object" ? strings.en.tabs : {};
  strings.zh.tabs = strings.zh.tabs && typeof strings.zh.tabs === "object" ? strings.zh.tabs : {};
  if (name) { strings.en.tabs[id] = name; strings.zh.tabs[id] = name; }
  else { delete strings.en.tabs[id]; delete strings.zh.tabs[id]; }
  await writeCustomJson(plugin, customStringsPath(plugin), strings);
}

function customGroupIdFromName(name) {
  return String(name == null ? "" : name).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 48);
}

// "" when the LaTeX is usable, otherwise a UI_STRINGS key describing the flaw.
function validateLatex(latex) {
  const value = String(latex == null ? "" : latex).trim();
  if (!value) return "latexRequired";
  if (value.includes("$")) return "latexNoDollar";
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const ch = value[index];
    if (ch === "\\") { index++; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < 0) return "latexBraces"; }
  }
  return depth === 0 ? "" : "latexBraces";
}

// Every LaTeX string the user could collide with: the loaded library plus every
// custom file on disk (including disabled categories).
async function collectKnownLatex(plugin) {
  const map = new Map();
  const add = function(latex, where) {
    const key = String(latex == null ? "" : latex).trim();
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(where);
  };
  for (const group of (FORMULA_DATA ? FORMULA_DATA.GROUPS : [])) {
    for (const item of group.items || []) {
      if (item && !item.section) add(item[1], { source: group.source || "builtin", group: group.id, label: item[0] });
    }
  }
  for (const meta of FORMULA_INDEX.custom) {
    const data = await readCustomGroup(plugin, meta);
    for (const item of data.items) {
      if (item && !item.section) add(item[1], { source: "custom", group: meta.id, label: item[0] });
    }
  }
  return map;
}

async function upsertCustomItem(plugin, meta, index, entry) {
  const data = await readCustomGroup(plugin, meta);
  if (typeof index === "number" && index >= 0 && index < data.items.length) data.items[index] = entry;
  else data.items.push(entry);
  await writeCustomGroup(plugin, meta, data);
}

async function deleteCustomItem(plugin, meta, index) {
  const data = await readCustomGroup(plugin, meta);
  if (index < 0 || index >= data.items.length) return;
  data.items.splice(index, 1);
  await writeCustomGroup(plugin, meta, data);
}

async function createCustomGroup(plugin, id, name) {
  await ensureCustomFolder(plugin);
  await writeCustomJson(plugin, customFolderFor(plugin) + "/" + id + ".json", { id: id, structures: false, items: [] });
  const order = await readCustomOrder(plugin);
  if (!order.includes(id)) { order.push(id); await writeCustomOrder(plugin, order); }
  await writeCustomGroupName(plugin, id, name);
}

async function deleteCustomGroup(plugin, meta) {
  const adapter = managerAdapter(plugin);
  if (adapter) {
    try {
      const path = customGroupPath(plugin, meta);
      if (await adapter.exists(path)) await adapter.remove(path);
    } catch (e) {
      logWarn("delete group file failed:", e.message);
    }
  }
  await writeCustomGroupName(plugin, meta.id, "");
  const order = (await readCustomOrder(plugin)).filter(function(id) { return id !== meta.id; });
  await writeCustomOrder(plugin, order);
  if (plugin.settings.customEnabledGroups) delete plugin.settings.customEnabledGroups[meta.id];
  await plugin.saveSettings();
}

// Parses pasted JSON, a JSON backup, or one "name<TAB>latex" per line.
function parseFormulaImport(text) {
  const raw = String(text == null ? "" : text).trim();
  const result = { entries: [], skipped: 0, groups: null, format: "lines" };
  if (!raw) return result;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) { result.entries = data; result.format = "json"; return result; }
    if (data && typeof data === "object") {
      if (Array.isArray(data.items)) { result.entries = data.items; result.format = "json"; return result; }
      if (Array.isArray(data.groups)) { result.groups = data.groups; result.format = "backup"; return result; }
    }
  } catch {
    // Not JSON: fall through to the line based format.
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    let parts = trimmed.split("\t").map(function(part) { return part.trim(); });
    parts = parts.filter(function(part, i) { return i === 0 || part.length > 0; });
    if (parts.length < 2) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) parts = [trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim()];
    }
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const entry = [parts[0], parts[1]];
      if (parts[2]) entry.push(parts[2]);
      result.entries.push(entry);
    } else result.skipped++;
  }
  return result;
}

// Drops empty/invalid duplicates and gives every entry a label.
function sanitizeImportedEntries(entries) {
  const seen = new Set();
  const items = [];
  let skipped = 0;
  for (const entry of entries || []) {
    let label = null, latex = null, enLabel = null;
    if (Array.isArray(entry)) {
      if (entry.length === 1) { label = entry[0]; latex = entry[0]; }
      else { label = entry[0]; latex = entry[1]; enLabel = entry[2]; }
    } else if (entry && typeof entry === "object") {
      if (entry.section) { items.push({ section: String(entry.section), sectionEn: String(entry.sectionEn || entry.section) }); continue; }
      label = entry.label || entry.name || entry.latex;
      latex = entry.latex;
      enLabel = entry.enLabel || entry.en;
    }
    latex = String(latex == null ? "" : latex).trim();
    if (!latex || validateLatex(latex)) { skipped++; continue; }
    if (seen.has(latex)) { skipped++; continue; }
    seen.add(latex);
    let item = [String(label == null || label === "" ? latex : label).trim() || latex, latex];
    if (enLabel) item.push(String(enLabel));
    const metadata = Array.isArray(entry) ? itemMeta(entry) : entry;
    if (metadata) item = withItemMeta(item, parseTagsInput(Array.isArray(metadata.tags) ? metadata.tags.join(",") : metadata.tags || ""), metadata.note || metadata.description || "");
    items.push(item);
  }
  return { items: items, skipped: skipped };
}

async function buildExportText(plugin, metas) {
  const lines = [];
  for (const meta of metas) {
    const data = await readCustomGroup(plugin, meta);
    lines.push("# " + groupDisplayName(plugin, meta.id) + " (" + meta.id + ")");
    for (const item of data.items) {
      if (!item) continue;
      if (item.section) { lines.push("# " + item.section); continue; }
      lines.push(String(item[0] == null ? "" : item[0]) + "\t" + String(item[1] == null ? "" : item[1]) + (item[2] ? "\t" + String(item[2]) : ""));
    }
  }
  return lines.join("\n") + "\n";
}

async function buildExportBackup(plugin, metas) {
  const groups = [];
  for (const meta of metas) {
    const data = await readCustomGroup(plugin, meta);
    groups.push({
      id: meta.id,
      name: groupDisplayName(plugin, meta.id),
      structures: !!data.structures,
      enabled: (plugin.settings.customEnabledGroups || {})[meta.id] !== false,
      items: data.items,
    });
  }
  return JSON.stringify({ format: "formula-library-custom", version: 1, exportedAt: new Date().toISOString(), groups: groups }, null, 2) + "\n";
}

function downloadTextFile(name, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
    return true;
  } catch (e) {
    logWarn("download failed:", e.message);
    return false;
  }
}

class CustomLibraryModal extends obsidian.Modal {
  constructor(app) {
    super(app);
    if (this.modalEl) this.modalEl.addClass("formula-custom-modal");
  }
}

class ConfirmModal extends CustomLibraryModal {
  constructor(app, plugin, title, detail, onConfirm) {
    super(app);
    this.plugin = plugin;
    this.titleText = title;
    this.detail = detail;
    this.onConfirm = onConfirm;
  }
  onOpen() {
    const p = this.plugin;
    this.titleEl.setText(this.titleText);
    this.contentEl.createEl("p", { text: this.detail });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "confirm") }).addEventListener("click", () => {
      this.close();
      if (this.onConfirm) this.onConfirm();
    });
  }
}

class FormulaItemModal extends CustomLibraryModal {
  constructor(app, plugin, meta, index, onDone) {
    super(app);
    this.plugin = plugin;
    this.meta = meta;
    this.index = typeof index === "number" ? index : -1;
    this.onDone = onDone;
  }
  async onOpen() {
    const p = this.plugin;
    const data = await readCustomGroup(p, this.meta);
    const current = this.index >= 0 && this.index < data.items.length ? data.items[this.index] : null;
    this.titleEl.setText(ui(p, current ? "manageEditFormula" : "manageAddFormula"));
    this.contentEl.addClass("formula-custom-form");
    const field = (labelText, value, placeholder) => {
      const wrap = this.contentEl.createDiv({ cls: "fl-field" });
      wrap.createEl("label", { text: labelText });
      const input = wrap.createEl("input", { cls: "fl-field-input", attr: { type: "text", placeholder: placeholder || "" } });
      input.value = value || "";
      return input;
    };
    this.nameInput = field(ui(p, "itemName"), current && current[0], "e.g. Quadratic formula");
    this.nameEnInput = field(ui(p, "itemNameEn"), current && current[2], "");
    this.latexInput = field(ui(p, "itemLatex"), current && current[1], "e.g. \\frac{a}{b}");
    this.tagsInput = field(ui(p, "itemTags"), formatTags(itemTags(current)), ui(p, "itemTagsPlaceholder"));
    this.noteInput = field(ui(p, "itemNote"), current ? itemNote(current) : "", ui(p, "itemNotePlaceholder"));
    this.errorEl = this.contentEl.createDiv({ cls: "fl-field-error" });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "save") }).addEventListener("click", () => runModalAction(this, () => this.save()));
  }
  async save() {
    const p = this.plugin;
    const latex = this.latexInput.value.trim();
    const name = this.nameInput.value.trim();
    const nameEn = this.nameEnInput.value.trim();
    const invalid = validateLatex(latex);
    if (invalid) { this.errorEl.setText(ui(p, invalid)); return; }
    const data = await readCustomGroup(p, this.meta);
    if (data.items.some((item, index) => index !== this.index && Array.isArray(item) && String(item[1]).trim() === latex)) {
      this.errorEl.setText(ui(p, "latexDuplicate"));
      return;
    }
    const current = this.index >= 0 && this.index < data.items.length ? data.items[this.index] : null;
    const known = await collectKnownLatex(p);
    const others = (known.get(latex) || []).filter((where) => !(where.source === "custom" && where.group === this.meta.id));
    if (others.length) { this.errorEl.setText(ui(p, "latexDuplicate") + ": " + others[0].group); return; }
    const entry = withItemMeta([name || latex, latex, nameEn || (current && current[2]) || ""], parseTagsInput(this.tagsInput.value), this.noteInput.value);
    await upsertCustomItem(p, this.meta, this.index, entry);
    await p.reloadFormulas();
    if (this.onDone) this.onDone();
    this.close();
  }
}

class GroupNameModal extends CustomLibraryModal {
  constructor(app, plugin, meta, onDone) {
    super(app);
    this.plugin = plugin;
    this.meta = meta;
    this.onDone = onDone;
  }
  async onOpen() {
    const p = this.plugin;
    this.titleEl.setText(ui(p, this.meta ? "manageRenameGroup" : "manageNewGroup"));
    this.contentEl.addClass("formula-custom-form");
    const wrap = this.contentEl.createDiv({ cls: "fl-field" });
    wrap.createEl("label", { text: ui(p, "groupName") });
    this.nameInput = wrap.createEl("input", { cls: "fl-field-input", attr: { type: "text", placeholder: "e.g. My formulas" } });
    this.nameInput.value = this.meta ? groupDisplayName(p, this.meta.id) : "";
    this.errorEl = this.contentEl.createDiv({ cls: "fl-field-error" });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "save") }).addEventListener("click", () => runModalAction(this, () => this.save()));
  }
  async save() {
    const p = this.plugin;
    const name = this.nameInput.value.trim();
    if (!name) { this.errorEl.setText(ui(p, "groupNameRequired")); return; }
    try {
      if (this.meta) {
        await writeCustomGroupName(p, this.meta.id, name);
      } else {
        const id = customGroupIdFromName(name) || "formulas-" + Date.now().toString(36);
        if (FORMULA_INDEX.custom.some(function(m) { return m.id === id; })) { this.errorEl.setText(ui(p, "groupExists")); return; }
        await createCustomGroup(p, id, name);
      }
    } catch (e) {
      this.errorEl.setText(String(e && e.message ? e.message : e));
      return;
    }
    await p.reloadFormulas();
    if (this.onDone) this.onDone();
    this.close();
  }
}

class ImportFormulasModal extends CustomLibraryModal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone;
  }
  onOpen() {
    const p = this.plugin;
    this.titleEl.setText(ui(p, "importTitle"));
    this.contentEl.addClass("formula-custom-form");
    this.contentEl.createEl("p", { cls: "setting-item-description", text: ui(p, "importDesc") });
    this.textInput = this.contentEl.createEl("textarea", { cls: "fe-textarea fl-import-textarea", attr: { rows: "8", placeholder: "name\\tlatex" } });
    const wrap = this.contentEl.createDiv({ cls: "fl-field" });
    wrap.createEl("label", { text: ui(p, "importTarget") });
    this.targetSel = wrap.createEl("select", { cls: "fl-group-select" });
    this.targetSel.createEl("option", { value: "__new__", text: ui(p, "importModeNew") });
    for (const meta of FORMULA_INDEX.custom) this.targetSel.createEl("option", { value: meta.id, text: groupDisplayName(p, meta.id) });
    this.newNameWrap = this.contentEl.createDiv({ cls: "fl-field" });
    this.newNameWrap.createEl("label", { text: ui(p, "importNewGroup") });
    this.newNameInput = this.newNameWrap.createEl("input", { cls: "fl-field-input", attr: { type: "text", placeholder: "e.g. My formulas" } });
    const toggleNew = () => { this.newNameWrap.style.display = this.targetSel.value === "__new__" ? "" : "none"; };
    this.targetSel.addEventListener("change", toggleNew);
    toggleNew();
    this.statusEl = this.contentEl.createDiv({ cls: "fl-field-error" });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "customImport") }).addEventListener("click", () => runModalAction(this, () => this.run()));
  }
  async run() {
    const p = this.plugin;
    const parsed = parseFormulaImport(this.textInput.value);
    if (parsed.format === "backup" && parsed.groups) { await this.importBackup(parsed); return; }
    const sanitized = sanitizeImportedEntries(parsed.entries);
    if (!sanitized.items.length) { this.statusEl.setText(ui(p, "importNothing")); return; }
    let meta = FORMULA_INDEX.custom.find((m) => m.id === this.targetSel.value) || null;
    if (!meta) {
      const name = this.newNameInput.value.trim() || ui(p, "customLibrary");
      const id = customGroupIdFromName(name) || "formulas-" + Date.now().toString(36);
      if (!FORMULA_INDEX.custom.some(function(m) { return m.id === id; })) await createCustomGroup(p, id, name);
      meta = { id: id, file: id + ".json", source: "custom", count: 0 };
    }
    const data = await readCustomGroup(p, meta);
    const existing = new Set(data.items.filter(function(item) { return item && !item.section; }).map(function(item) { return String(item[1]).trim(); }));
    let added = 0, duplicates = 0;
    for (const item of sanitized.items) {
      if (item.section) { data.items.push(item); continue; }
      const key = String(item[1]).trim();
      if (existing.has(key)) { duplicates++; continue; }
      existing.add(key);
      data.items.push(item);
      added++;
    }
    await writeCustomGroup(p, meta, data);
    if (added) {
      const order = await readCustomOrder(p);
      if (!order.includes(meta.id)) { order.push(meta.id); await writeCustomOrder(p, order); }
    }
    await p.reloadFormulas();
    this.statusEl.setText(ui(p, "importResult") + ": " + added + " · " + ui(p, "importSkipped") + ": " + (duplicates + sanitized.skipped));
    if (this.onDone) this.onDone();
  }
  async importBackup(parsed) {
    const p = this.plugin;
    let added = 0;
    const metas = new Map(FORMULA_INDEX.custom.map((meta) => [meta.id, meta]));
    for (const group of parsed.groups) {
      if (!group || !Array.isArray(group.items)) continue;
      const items = sanitizeImportedEntries(group.items || []).items;
      if (!items.length) continue;
      const name = String(group.name || group.id || "formulas");
      const id = customGroupIdFromName(group.id || name) || "formulas-" + Date.now().toString(36);
      let meta = metas.get(id);
      if (!meta) {
        await createCustomGroup(p, id, name);
        meta = { id: id, file: id + ".json", source: "custom", count: 0 };
        metas.set(id, meta);
        p.settings.customEnabledGroups[id] = group.enabled !== false;
      }
      const data = await readCustomGroup(p, meta);
      data.structures = data.structures || !!group.structures;
      const known = new Set(data.items.filter(Array.isArray).map((item) => String(item[1]).trim()));
      let section = null;
      for (const item of items) {
        if (item.section) { section = item; continue; }
        if (known.has(item[1])) continue;
        if (section) { data.items.push(section); section = null; }
        known.add(item[1]);
        data.items.push(item);
        added++;
      }
      await writeCustomGroup(p, meta, data);
    }
    await p.saveSettings();
    await p.reloadFormulas();
    this.statusEl.setText(ui(p, "importResult") + ": " + added);
    if (this.onDone) this.onDone();
  }
}

class ExportFormulasModal extends CustomLibraryModal {
  constructor(app, plugin, meta) {
    super(app);
    this.plugin = plugin;
    this.meta = meta;
  }
  async onOpen() {
    const p = this.plugin;
    this.metas = this.meta ? [this.meta] : FORMULA_INDEX.custom.slice();
    this.titleEl.setText(ui(p, "exportTitle"));
    this.contentEl.addClass("formula-custom-form");
    const label = this.meta ? groupDisplayName(p, this.meta.id) : ui(p, "exportAll");
    this.contentEl.createEl("p", { cls: "setting-item-description", text: label + " · " + this.metas.length });
    const wrap = this.contentEl.createDiv({ cls: "fl-field" });
    this.formatSel = wrap.createEl("select", { cls: "fl-group-select" });
    this.formatSel.createEl("option", { value: "lines", text: ui(p, "exportFormatLines") });
    this.formatSel.createEl("option", { value: "json", text: ui(p, "exportFormatJson") });
    this.formatSel.addEventListener("change", () => { this.build(); });
    this.textInput = this.contentEl.createEl("textarea", { cls: "fe-textarea fl-import-textarea", attr: { rows: "10" } });
    this.statusEl = this.contentEl.createDiv({ cls: "fl-field-error" });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "exportCopy") }).addEventListener("click", () => { this.copy(); });
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "exportDownload") }).addEventListener("click", () => { this.download(); });
    await this.build();
  }
  async build() {
    if (!this.metas.length) { this.textInput.value = ""; this.statusEl.setText(ui(this.plugin, "exportEmpty")); return; }
    this.statusEl.setText("");
    this.textInput.value = this.formatSel.value === "json"
      ? await buildExportBackup(this.plugin, this.metas)
      : await buildExportText(this.plugin, this.metas);
  }
  async copy() {
    const ok = await writeClipboard(this.textInput.value);
    this.statusEl.setText(ui(this.plugin, ok ? "exportCopied" : "exportCopyFailed"));
  }
  download() {
    const name = (this.meta ? this.meta.id : "formulas") + (this.formatSel.value === "json" ? ".json" : ".txt");
    if (!downloadTextFile(name, this.textInput.value)) this.copy();
  }
}

class CustomFormulasModal extends CustomLibraryModal {
  constructor(app, plugin, onChange) {
    super(app);
    this.plugin = plugin;
    this.onChange = onChange;
  }
  async onOpen() {
    const p = this.plugin;
    this.titleEl.setText(ui(p, "manageTitle"));
    this.contentEl.addClass("formula-custom-manager");
    this.contentEl.createEl("p", { cls: "setting-item-description", text: ui(p, "manageFolder") + ": " + customFolderFor(p) });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(p, "manageNewGroup") }).addEventListener("click", () => { new GroupNameModal(this.app, p, null, () => this.refresh()).open(); });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "customImport") }).addEventListener("click", () => { new ImportFormulasModal(this.app, p, () => this.refresh()).open(); });
    bar.createEl("button", { cls: "fl-btn", text: ui(p, "customExport") }).addEventListener("click", () => { new ExportFormulasModal(this.app, p, null).open(); });
    this.listEl = this.contentEl.createDiv({ cls: "fl-manage-list" });
    await this.renderGroups();
  }
  async refresh() {
    await this.plugin.reloadFormulas();
    await this.renderGroups();
    if (this.onChange) this.onChange();
  }
  async renderGroups() {
    const p = this.plugin;
    this.listEl.empty();
    if (!FORMULA_INDEX.custom.length) {
      this.listEl.createEl("p", { cls: "fl-empty-state", text: ui(p, "manageEmpty") });
      return;
    }
    for (const meta of FORMULA_INDEX.custom) {
      const card = this.listEl.createDiv({ cls: "fl-manage-group" });
      const head = card.createDiv({ cls: "fl-manage-head" });
      head.createDiv({ cls: "fl-manage-title", text: groupDisplayName(p, meta.id) + " (" + meta.count + ")" });
      head.createDiv({ cls: "fl-manage-file", text: meta.file });
      const actions = head.createDiv({ cls: "fl-manage-actions" });
      const button = (label, handler) => { actions.createEl("button", { cls: "fl-btn", text: label }).addEventListener("click", handler); };
      button(ui(p, "manageAddFormula"), () => { new FormulaItemModal(this.app, p, meta, -1, () => this.refresh()).open(); });
      button(ui(p, "manageRenameGroup"), () => { new GroupNameModal(this.app, p, meta, () => this.refresh()).open(); });
      button(ui(p, "manageExportGroup"), () => { new ExportFormulasModal(this.app, p, meta).open(); });
      button(ui(p, "manageDeleteGroup"), () => {
        new ConfirmModal(this.app, p, ui(p, "manageDeleteGroup"), groupDisplayName(p, meta.id), async () => {
          await deleteCustomGroup(p, meta);
          await this.refresh();
        }).open();
      });
      const data = await readCustomGroup(p, meta);
      const itemsEl = card.createDiv({ cls: "fl-manage-items" });
      if (!data.items.some(function(item) { return item && !item.section; })) {
        itemsEl.createDiv({ cls: "fl-manage-item is-empty", text: ui(p, "manageEmpty") });
      }
      data.items.forEach((item, index) => {
        if (!item) return;
        if (item.section) { itemsEl.createDiv({ cls: "fl-manage-section", text: item.section }); return; }
        const row = itemsEl.createDiv({ cls: "fl-manage-item" });
        row.createDiv({ cls: "fl-manage-item-label", text: itemLabel(p, item) });
        row.createDiv({ cls: "fl-manage-item-latex", text: String(item[1] == null ? "" : item[1]) });
        const tags = itemTags(item);
        const note = itemNote(item);
        if (tags.length) row.createDiv({ cls: "fl-manage-item-tags", text: formatTags(tags) });
        if (note) row.createDiv({ cls: "fl-manage-item-note", text: note });
        const rowActions = row.createDiv({ cls: "fl-manage-actions" });
        rowActions.createEl("button", { cls: "fl-btn", text: ui(p, "manageEditFormula") })
          .addEventListener("click", () => { new FormulaItemModal(this.app, p, meta, index, () => this.refresh()).open(); });
        rowActions.createEl("button", { cls: "fl-btn", text: ui(p, "manageDeleteFormula") })
          .addEventListener("click", () => {
            new ConfirmModal(this.app, p, ui(p, "manageDeleteFormula"), String(item[0] == null ? "" : item[0]), async () => {
              await deleteCustomItem(p, meta, index);
              await this.refresh();
            }).open();
          });
      });
    }
  }
}

async function writeClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(String(text == null ? "" : text));
      return true;
    }
  } catch (e) {
    logWarn("clipboard write failed:", e.message);
  }
  return false;
}

export { customFolderFor, managerAdapter, customIndexPath, customStringsPath, customGroupPath, ensureCustomFolder, readCustomJson, writeCustomJson, readCustomGroup, writeCustomGroup, readCustomOrder, writeCustomOrder, readCustomStrings, writeCustomGroupName, customGroupIdFromName, validateLatex, collectKnownLatex, upsertCustomItem, deleteCustomItem, createCustomGroup, deleteCustomGroup, parseFormulaImport, sanitizeImportedEntries, buildExportText, buildExportBackup, downloadTextFile, ConfirmModal, FormulaItemModal, GroupNameModal, ImportFormulasModal, ExportFormulasModal, CustomFormulasModal, writeClipboard };
