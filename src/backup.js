import * as obsidian from "obsidian";
import { DEFAULT_SETTINGS, FORMULA_INDEX, loc, groupDisplayName } from "./core.js";
import { customFolderFor, readCustomGroup, ensureCustomFolder, sanitizeImportedEntries, downloadTextFile } from "./custom-library.js";
import { validateCustomParamTemplate } from "./parameters.js";
import { safeJson, clone, validatePlotConfig } from "./workspace-state.js";
import { labelControl, runModalAction } from "./ui.js";

const PATH_KEYS = ["formulasPath", "customFormulasPath", "plotFolder"];
const CONTENT_KEYS = ["favorites", "pinnedFormulas", "hiddenFormulas", "recentFormulas", "usageCounts", "paramPresets", "customParamTemplates", "plotPresets", "formulaDraft", "plotDraft", "drawingDraft"];
const message = (p, zh, en) => loc(p) === "zh" ? zh : en;

async function buildWorkspaceBackup(plugin) {
  if (customFolderFor(plugin) !== FORMULA_INDEX.customFolder) await plugin.reloadFormulas();
  if (FORMULA_INDEX.errors.length) throw new Error(message(plugin, "请先解决公式库加载错误，再备份", "Resolve library loading errors before backing up"));
  const groups = [];
  for (const meta of FORMULA_INDEX.custom) {
    const data = await readCustomGroup(plugin, meta);
    groups.push({ id: meta.id, name: groupDisplayName(plugin, meta.id), structures: !!data.structures, items: data.items, enabled: plugin.settings.customEnabledGroups[meta.id] !== false });
  }
  const settings = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) settings[key] = clone(plugin.settings[key] ?? DEFAULT_SETTINGS[key]);
  return JSON.stringify({ format: "formula-library-workspace", version: 1, exportedAt: new Date().toISOString(), groups, settings }, null, 2);
}

function parseWorkspaceBackup(text) {
  if (text.length > 10000000) throw new Error("Backup exceeds 10 MB");
  const data = safeJson(JSON.parse(text));
  if (!data || data.format !== "formula-library-workspace" || data.version !== 1) throw new Error("Unsupported workspace backup (expected version 1)");
  if (!Array.isArray(data.groups) || data.groups.length > 500) throw new Error("Invalid categories");
  const ids = new Set();
  for (const group of data.groups) {
    if (!group || !/^[a-zA-Z0-9_-]{1,64}$/.test(group.id) || ["__proto__", "constructor", "prototype"].includes(group.id) || ids.has(group.id)) throw new Error("Invalid or duplicate category id");
    ids.add(group.id);
    if (!Array.isArray(group.items) || typeof group.name !== "string" || typeof group.enabled !== "boolean" || typeof group.structures !== "boolean") throw new Error("Invalid category: " + group.id);
    const clean = sanitizeImportedEntries(group.items);
    if (clean.skipped) throw new Error("Invalid or duplicate formulas in " + group.id);
    group.items = clean.items;
  }
  if (!data.settings || Array.isArray(data.settings) || typeof data.settings !== "object") throw new Error("Invalid settings");
  const settings = {};
  for (const [key, value] of Object.entries(data.settings)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) continue;
    const fallback = DEFAULT_SETTINGS[key];
    if (fallback !== null && (Array.isArray(fallback) ? !Array.isArray(value) : typeof value !== typeof fallback || (typeof fallback === "object" && (!value || Array.isArray(value))))) throw new Error("Invalid setting: " + key);
    settings[key] = value;
  }
  const enums = { locale: ["auto", "en", "zh"], insertFormat: ["display", "inline"], defaultEditorMode: ["visual", "source"], mathFontStyle: ["italic", "upright"], libraryDensity: ["compact", "comfortable", "spacious"], librarySort: ["smart", "usage", "recent", "alphabetical"] };
  for (const [key, choices] of Object.entries(enums)) if (key in settings && !choices.includes(settings[key])) throw new Error("Invalid setting: " + key);
  for (const [key, min, max] of [["previewFontSize", 12, 40], ["libraryFontSize", 14, 32], ["searchResultLimit", 1, 10000]]) if (key in settings && (settings[key] < min || settings[key] > max)) throw new Error("Invalid setting: " + key);
  for (const key of ["enabledGroups", "customEnabledGroups"]) if (Object.values(settings[key] || {}).some((value) => typeof value !== "boolean")) throw new Error("Invalid category switches");
  if (Object.values(settings.usageCounts || {}).some((value) => typeof value !== "number" || value < 0)) throw new Error("Invalid usage counts");
  if (Object.values(settings.shortcuts || {}).some((value) => typeof value !== "string")) throw new Error("Invalid shortcuts");
  for (const list of Object.values(settings.paramPresets || {})) {
    if (!Array.isArray(list) || list.length > 20 || list.some((entry) => !entry || typeof entry.name !== "string" || !entry.values || typeof entry.values !== "object" || Array.isArray(entry.values) || Object.values(entry.values).some((value) => typeof value !== "string"))) throw new Error("Invalid parameter presets");
  }
  for (const key of ["favorites", "pinnedFormulas", "hiddenFormulas", "recentFormulas"]) {
    if (settings[key]?.some((value) => typeof value !== "string")) throw new Error("Invalid formula list: " + key);
  }
  if ((settings.customParamTemplates || []).length > 200) throw new Error("Too many templates");
  const templateKeys = new Set();
  for (const template of settings.customParamTemplates || []) {
    if (!template || !Array.isArray(template.params) || template.params.some((param) => !param || typeof param.name !== "string")) throw new Error("Invalid template parameters");
    const error = validateCustomParamTemplate(template);
    if (error || typeof template.key !== "string" || !template.key.startsWith("custom-") || templateKeys.has(template.key)) throw new Error(error || "Invalid or duplicate template key");
    templateKeys.add(template.key);
  }
  const plotNames = new Set();
  if ((settings.plotPresets || []).length > 50) throw new Error("Too many plot presets");
  for (const preset of settings.plotPresets || []) {
    if (!preset || typeof preset.name !== "string" || !preset.name.trim() || plotNames.has(preset.name)) throw new Error("Invalid or duplicate plot preset");
    plotNames.add(preset.name);
    validatePlotConfig(preset.config);
  }
  for (const key of ["formulaDraft", "plotDraft"]) {
    const draft = settings[key];
    if (draft && (draft.version !== 1 || !draft.data || typeof draft.data !== "object" || Array.isArray(draft.data))) throw new Error("Invalid draft: " + key);
    if (key === "formulaDraft" && draft && (typeof draft.data.latex !== "string" || typeof draft.data.context !== "string" || !["source", "visual"].includes(draft.data.mode))) throw new Error("Invalid formula draft");
    // Invalid expressions/ranges are legitimate unfinished drafts, but the form
    // structure must be safe to hydrate. JSON null represents an unfinished number.
    if (key === "plotDraft" && draft) {
      const config = draft.data;
      if (config.version !== 1 || !Array.isArray(config.curves) || config.curves.length > 30 || config.curves.some((curve) => !curve || typeof curve.expression !== "string" || typeof curve.locals !== "string") || typeof config.definitions !== "string" || !config.range || typeof config.autoY !== "boolean" || !["auto", "light", "dark"].includes(config.theme) || !config.parameters || Array.isArray(config.parameters)) throw new Error("Invalid plot draft");
      for (const [name, param] of Object.entries(config.parameters)) if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) || !param || ["value", "min", "max", "step"].some((key) => param[key] !== null && typeof param[key] !== "number")) throw new Error("Invalid plot draft parameter");
    }
  }
  if (settings.drawingDraft && (typeof settings.drawingDraft.source !== "string" || typeof settings.drawingDraft.templateKey !== "string" || !["source", "visual"].includes(settings.drawingDraft.mode))) throw new Error("Invalid diagram draft");
  data.settings = settings;
  return data;
}

// Additive restore: never delete unrelated categories, never import paths.
// Stage all reads before writes and restore original bytes on failure.
async function performWorkspaceRestore(plugin, data, { conflict = "keep", preferences = false } = {}) {
  data = parseWorkspaceBackup(JSON.stringify(data));
  if (!["keep", "replace"].includes(conflict)) throw new Error("Invalid conflict policy");
  const adapter = plugin.app.vault.adapter;
  const originalSettings = clone(plugin.settings);
  const folder = customFolderFor(plugin) || "my-formulas";
  if (folder.split("/").some((part) => part === "." || part === "..") || /^\/|^[a-z]:|\\/i.test(folder) || folder.split("/").some((part) => part.startsWith("."))) throw new Error("Use a non-hidden folder inside the vault");
  const staged = new Map();
  const before = new Map();
  const read = async (path, fallback) => {
    const bytes = await adapter.exists(path) ? await adapter.read(path) : null;
    before.set(path, bytes);
    return bytes === null ? clone(fallback) : safeJson(JSON.parse(bytes));
  };
  const indexPath = folder + "/_index.json", stringsPath = folder + "/_strings.json";
  const index = await read(indexPath, { order: [] });
  const strings = await read(stringsPath, {});
  if (!index || !Array.isArray(index.order) || !strings || typeof strings !== "object" || Array.isArray(strings)) throw new Error("Invalid existing library index/strings");
  const next = clone(originalSettings);
  next.customFormulasPath = folder;
  for (const group of data.groups) {
    const meta = FORMULA_INDEX.customFolder === folder ? FORMULA_INDEX.custom.find((entry) => entry.id === group.id) : null;
    const file = meta?.file || group.id + ".json";
    if (!/^[^./\\][^/\\]*\.json$/.test(file)) throw new Error("Unsafe category file name");
    const path = folder + "/" + file;
    const existing = await read(path, { id: group.id, structures: group.structures, items: [] });
    if (!existing || !Array.isArray(existing.items) || (existing.id && existing.id !== group.id)) throw new Error("Invalid or conflicting existing category: " + group.id);
    const items = existing.items.slice();
    for (const item of group.items) {
      if (item.section) { if (!items.some((entry) => entry?.section === item.section)) items.push(item); continue; }
      const at = items.findIndex((entry) => Array.isArray(entry) && entry[1] === item[1]);
      if (at < 0) items.push(item);
      else if (conflict === "replace") items[at] = item;
    }
    staged.set(path, { ...existing, items });
    if (!index.order.includes(group.id)) index.order.push(group.id);
    for (const locale of ["en", "zh"]) {
      strings[locale] ||= {}; strings[locale].tabs ||= {};
      if (typeof strings[locale] !== "object" || Array.isArray(strings[locale]) || typeof strings[locale].tabs !== "object" || Array.isArray(strings[locale].tabs)) throw new Error("Invalid existing category names");
      if (!strings[locale].tabs[group.id] || conflict === "replace") strings[locale].tabs[group.id] = group.name;
    }
    if (!Object.hasOwn(next.customEnabledGroups, group.id) || conflict === "replace") next.customEnabledGroups[group.id] = group.enabled;
  }
  staged.set(indexPath, index); staged.set(stringsPath, strings);
  for (const [key, incoming] of Object.entries(data.settings)) {
    if (PATH_KEYS.includes(key) || key === "customEnabledGroups" || (!preferences && !CONTENT_KEYS.includes(key))) continue;
    const current = next[key];
    if (Array.isArray(incoming)) {
      if (key === "customParamTemplates" || key === "plotPresets") {
        const id = key === "plotPresets" ? "name" : "key";
        const merged = new Map((current || []).map((entry) => [entry[id], entry]));
        incoming.forEach((entry) => { if (!merged.has(entry[id]) || conflict === "replace") merged.set(entry[id], entry); });
        next[key] = [...merged.values()];
      } else next[key] = [...new Set([...(current || []), ...incoming])];
    } else if (key === "paramPresets") {
      const merged = { ...current };
      for (const [templateKey, presets] of Object.entries(incoming)) {
        const byName = new Map((merged[templateKey] || []).map((preset) => [preset.name, preset]));
        presets.forEach((preset) => { if (!byName.has(preset.name) || conflict === "replace") byName.set(preset.name, preset); });
        if (byName.size > 20) throw new Error("Restore would exceed 20 parameter presets for " + templateKey);
        merged[templateKey] = [...byName.values()];
      }
      next[key] = merged;
    } else if (incoming && typeof incoming === "object" && !key.endsWith("Draft")) {
      next[key] = conflict === "replace" ? { ...current, ...incoming } : { ...incoming, ...current };
    } else if (preferences || !current || conflict === "replace") next[key] = incoming;
  }
  if (next.customParamTemplates.length > 200 || next.plotPresets.length > 50) throw new Error("Restore would exceed template/preset limits");
  if (next.rememberDrafts === false) for (const key of ["formulaDraft", "plotDraft", "drawingDraft"]) next[key] = null;
  const written = [];
  try {
    await ensureCustomFolder({ ...plugin, settings: next });
    for (const [path, bytes] of before) {
      const current = await adapter.exists(path) ? await adapter.read(path) : null;
      if (current !== bytes) throw new Error("Destination changed during preview: " + path);
    }
    for (const [path, value] of staged) {
      written.push(path);
      await adapter.write(path, JSON.stringify(value, null, 2) + "\n");
    }
    plugin.settings = next;
    await plugin.saveSettings();
  } catch (error) {
    plugin.settings = originalSettings;
    const failures = [];
    for (const path of written.reverse()) {
      try { if (before.get(path) === null) { if (await adapter.exists(path)) await adapter.remove(path); } else await adapter.write(path, before.get(path)); }
      catch { failures.push(path); }
    }
    try { await plugin.saveSettings(); } catch { failures.push("plugin settings"); }
    throw new Error(error.message + (failures.length ? " — rollback incomplete: " + failures.join(", ") : " — changes rolled back"));
  }
  await plugin.reloadFormulas();
}

async function restoreWorkspaceBackup(plugin, data, options) {
  if (plugin._workspaceRestorePending) throw new Error("A workspace restore is already running");
  plugin._workspaceRestorePending = true;
  try { return await performWorkspaceRestore(plugin, data, options); }
  finally { plugin._workspaceRestorePending = false; }
}

class WorkspaceBackupModal extends obsidian.Modal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    const p = this.plugin, t = (zh, en) => message(p, zh, en);
    this.modalEl.addClass("formula-custom-modal");
    this.modalEl.addClass("formula-backup-modal");
    this.titleEl.setText(t("备份与恢复", "Backup and restore"));
    this.contentEl.addClass("fl-backup-content");
    this.contentEl.createEl("p", { cls: "fl-backup-description", text: t("备份个人公式、模板、预设、收藏、草稿和设置。内置公式无需备份。", "Back up personal formulas, templates, presets, favorites, drafts and settings. Built-in formulas need no backup.") });
    const exportSection = this.contentEl.createDiv({ cls: "fl-backup-export" });
    const exportInfo = exportSection.createDiv();
    exportInfo.createEl("h3", { text: t("导出", "Export") });
    exportInfo.createEl("p", { cls: "fl-backup-description", text: t("下载一份完整的 JSON 备份，保存到设备上。", "Download a complete JSON backup to your device.") });
    const exportButton = exportSection.createEl("button", { cls: "fl-btn", text: t("下载完整备份", "Download full backup") });
    exportButton.addEventListener("click", () => runModalAction(this, async () => {
      const text = await buildWorkspaceBackup(p);
      if (!downloadTextFile("formula-library-backup-" + new Date().toISOString().slice(0, 10) + ".json", text, "application/json")) throw new Error(t("下载失败", "Download failed"));
      this.statusEl.setText(t("备份已下载", "Backup downloaded"));
    }));
    const restoreSection = this.contentEl.createDiv({ cls: "fl-backup-restore" });
    restoreSection.createEl("h3", { text: t("恢复", "Restore") });
    restoreSection.createEl("p", { cls: "fl-backup-description", text: t("选择文件或粘贴 JSON，检查预览后再确认。现有文件夹路径不会更改。", "Choose a file or paste JSON, then validate before confirming. Existing folder paths stay unchanged.") });
    const fileRow = restoreSection.createDiv({ cls: "fl-backup-file-row" });
    const file = fileRow.createEl("input", { attr: { type: "file", accept: ".json,application/json", hidden: "true", "aria-label": t("备份 JSON 文件", "Backup JSON file") } });
    const chooseFile = fileRow.createEl("button", { cls: "fl-btn", text: t("选择 JSON 文件", "Choose JSON file") });
    chooseFile.addEventListener("click", () => file.click());
    const fileName = fileRow.createSpan({ cls: "fl-backup-file-name", text: t("未选择文件 · 最大 10 MB", "No file selected · up to 10 MB") });
    file.addEventListener("change", () => runModalAction(this, async () => {
      if (!file.files[0]) return;
      if (file.files[0].size > 10000000) throw new Error("Backup exceeds 10 MB");
      this.textarea.value = await file.files[0].text(); fileName.setText(file.files[0].name); this.invalidate();
    }));
    this.textarea = restoreSection.createEl("textarea", { cls: "fl-import-textarea", attr: { rows: "5", spellcheck: "false", placeholder: t("或在此粘贴完整 JSON 备份…", "Or paste a full JSON backup here…") } });
    labelControl(this.textarea, t("备份内容", "Backup content"));
    this.textarea.addEventListener("input", () => this.invalidate());
    const policy = restoreSection.createEl("select");
    policy.createEl("option", { value: "keep", text: t("冲突时保留现有内容", "Keep existing on conflict") });
    policy.createEl("option", { value: "replace", text: t("冲突时使用备份内容", "Use backup on conflict") });
    labelControl(policy, t("冲突处理（未匹配的内容始终保留）", "Conflict policy (unmatched content is always kept)"));
    policy.addEventListener("change", () => this.invalidate());
    const check = restoreSection.createEl("label", { cls: "mt-check fl-backup-preferences" });
    const preferences = check.createEl("input", { attr: { type: "checkbox" } });
    check.createSpan({ text: t("同时恢复界面和分类设置（不含路径）", "Also restore UI and category preferences (excluding paths)") });
    preferences.addEventListener("change", () => this.invalidate());
    this.statusEl = this.contentEl.createDiv({ cls: "fl-backup-status", attr: { role: "status", "aria-live": "polite" } });
    const actions = this.contentEl.createDiv({ cls: "fl-backup-footer" });
    const preview = actions.createEl("button", { cls: "fl-btn", text: t("检查并预览", "Validate and preview") });
    this.restoreButton = actions.createEl("button", { cls: "fl-btn fl-btn-primary", text: t("确认恢复", "Confirm restore") });
    this.restoreButton.disabled = true;
    preview.addEventListener("click", () => {
      this.invalidate();
      try {
        this.validated = parseWorkspaceBackup(this.textarea.value);
        const count = this.validated.groups.reduce((n, g) => n + g.items.filter(Array.isArray).length, 0);
        this.statusEl.setText(`${this.validated.groups.length} ${t("分类", "categories")} · ${count} ${t("公式", "formulas")} · ${(this.validated.settings.customParamTemplates || []).length} ${t("个人模板", "personal templates")} · ${(this.validated.settings.plotPresets || []).length} ${t("绘图预设", "plot presets")}\n${t("目标文件夹：", "Destination: ")}${customFolderFor(p) || "my-formulas"}\n${policy.selectedOptions[0].textContent}`);
        this.restoreButton.disabled = false;
      } catch (error) { this.statusEl.setAttribute("role", "alert"); this.statusEl.setText(error instanceof SyntaxError ? t("JSON 格式不完整，请重新选择文件或检查粘贴内容。", "Invalid JSON. Choose the file again or check the pasted content.") : error.message); }
      this.statusEl.scrollIntoView({ block: "center" });
    });
    this.restoreButton.addEventListener("click", async () => {
      if (!this.validated) return;
      await runModalAction(this, async () => {
        await restoreWorkspaceBackup(p, this.validated, { conflict: policy.value, preferences: preferences.checked });
        this.validated = null;
        this.statusEl.setText(t("恢复完成，未匹配的现有内容已保留", "Restored; unmatched existing content was kept"));
      });
      this.restoreButton.disabled = !this.validated;
    });
    actions.createEl("button", { cls: "fl-btn", text: t("关闭", "Close") }).addEventListener("click", () => this.close());
  }
  invalidate() { this.validated = null; this.restoreButton.disabled = true; this.statusEl.setAttribute("role", "status"); this.statusEl.setText(""); }
}

export { buildWorkspaceBackup, parseWorkspaceBackup, restoreWorkspaceBackup, WorkspaceBackupModal };
