import * as obsidian from "obsidian";
import { FORMULA_DATA, DEFAULT_SETTINGS, log, logWarn, logErr, ui, trackUsage, FORMULA_INDEX, normalizeFolderPath, loadFormulas } from "./core.js";
import { loadMathLive } from "./mathlive.js";
import { FormulaLibrarySettingTab } from "./settings.js";
import { managerAdapter } from "./custom-library.js";
import { ParamTemplateModal } from "./parameters.js";
import { MatrixPasteModal } from "./matrix.js";
import { plotFileName, PlotFunctionModal } from "./plot.js";
import { SidebarView } from "./sidebar.js";
import { EditorModal } from "./editor.js";
import { findMermaidBlockAt, DrawingModal } from "./drawing.js";
import { findPlotBlockAt, plotConfigComment } from "./workspace-state.js";
import { FormulaDetailsModal } from "./formula-details.js";
import { WorkspaceBackupModal } from "./backup.js";
import { FormulaConversionModal } from "./conversion.js";
import { CoreConversionService, CoreConversionError } from "./core-conversion.js";
import { createBundledCoreSession } from "./core-assets.js";
import { isToolEnabled, normalizeEnabledTools, DEFAULT_ENABLED_TOOLS } from "./tools.js";

// ======================== Plugin ========================
class FormulaLibraryPlugin extends obsidian.Plugin {
  async onload() {
    this._coreUnloaded = false;
    log("Loading...");
    await this.loadSettings();

    const loaded = await loadFormulas(this);
    if (!loaded || !FORMULA_DATA) {
      logErr("DATA NOT LOADED");
      new obsidian.Notice("Formula Library: failed to load formula data. Check the formulas/ folder.");
      return;
    }
    log("Data OK, groups:", FORMULA_DATA.GROUPS.length);

    // Seeded after loading so it can see every group (built-in and custom).
    // Only missing switches are seeded: user choices are never overwritten.
    await this.initEnabledGroups();

    loadMathLive(this);

    this._activeEditor = null;
    this._editorModals = new Set();
    this._conversionModals = new Set();
    this._coreService = null;
    this._reloadTimer = null;

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf && leaf.view instanceof obsidian.MarkdownView && leaf.view.editor) {
          this._activeEditor = leaf.view.editor;
          log("Tracked active editor from leaf change");
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const v = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (v && v.editor) {
          this._activeEditor = v.editor;
        }
      })
    );

    this.registerView("formula-library-sidebar", (l) => new SidebarView(l, this));
    this.addSettingTab(new FormulaLibrarySettingTab(this.app, this));
    this.addRibbonIcon("sigma", "Formula Library", () => { log("Ribbon clicked"); this.toggleSidebar(); });
    this.addCommand({ id: "open-editor", name: "Open Formula Editor", callback: () => { log("Command: open-editor"); this.openEditor("insert"); } });
    this.addToolCommand("mermaid", { id: "open-mermaid-diagram", name: "Open Mermaid Diagram Editor", callback: () => this.openDrawing() });
    this.addToolCommand("templates", { id: "open-param-templates", name: "Insert Parameterized Formula", callback: () => this.openParamTemplates() });
    this.addToolCommand("matrix", { id: "paste-matrix-data", name: "Paste Matrix Data", callback: () => this.openMatrixPaste() });
    this.addToolCommand("plot", { id: "plot-function", name: "Plot Function", callback: () => this.openFunctionPlot() });
    this.addCommand({ id: "manage-backups", name: "Manage Formula Library Backups", callback: () => this.openWorkspaceBackup() });
    this.addToolCommand("conversion", { id: "convert-formula", name: "Convert Formula Format", callback: () => this.openConversion() });
    this.addToolCommand("plot", { id: "edit-plot-at-cursor", name: "Edit Function Plot at Cursor", checkCallback: (checking) => {
      const editor = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
      const info = editor && findPlotBlockAt(editor.getValue(), editor.posToOffset(editor.getCursor()));
      if (!info) return false;
      if (!checking) new PlotFunctionModal(this.app, this, { config: info.config, plotInfo: info, editor }).open();
      return true;
    } });
    this.addToolCommand("mermaid", {
      id: "edit-mermaid-diagram-at-cursor",
      name: "Edit Mermaid diagram at cursor",
      checkCallback: (checking) => {
        const info = this.getDrawingAtCursor();
        if (!info) return false;
        if (!checking) {
          log("Command: edit-mermaid-diagram-at-cursor");
          this.openDrawing(info.source, info);
        }
        return true;
      }
    });
    // Discoverability: offer the same action from the editor context menu.
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      if (!isToolEnabled(this, "mermaid")) return;
      const info = this.getDrawingAtCursor(editor);
      if (!info) return;
      menu.addItem((item) => item.setTitle(ui(this, "drawingEditExisting")).setIcon("workflow").onClick(() => this.openDrawing(info.source, info)));
    }));
    this.addCommand({
      id: "edit-at-cursor", name: "Edit Formula at Cursor",
      checkCallback: (c) => { const i = this.getFormulaAtCursor(); if (i) { if (!c) { log("Command: edit-at-cursor, latex:", i.latex); this.openEditor("update", i.latex, i); } return true; } return false; },
    });
    this.addCommand({ id: "toggle-sidebar", name: "Toggle Formula Library Sidebar", callback: () => { log("Command: toggle-sidebar"); this.toggleSidebar(); } });
    log("Loaded OK");
  }

  onunload() {
    this._coreUnloaded = true;
    log("Unloading");
    for (const modal of this._conversionModals || []) modal.close();
    this._conversionModals?.clear();
    this._coreService?.dispose().catch((error) => logWarn("Core cleanup failed:", error.code || error.message));
    this._coreService = null;
    if (this._reloadTimer) { window.clearTimeout(this._reloadTimer); this._reloadTimer = null; }
    if (this._editorModals) this._editorModals.clear();
    try {
      document.querySelectorAll('script[src*="mathlive"]').forEach((el) => el.remove());
    } catch {}
    try {
      const leaves = this.app.workspace.getLeavesOfType("formula-library-sidebar");
      for (const leaf of leaves) {
        try { leaf.detach(); } catch {}
      }
    } catch (e) {
      logWarn("detachLeaves failed:", e.message);
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.enabledTools = normalizeEnabledTools(data.enabledTools);
    this.settings.customParamTemplates = Array.isArray(data.customParamTemplates) ? JSON.parse(JSON.stringify(data.customParamTemplates)) : [];
    this.settings.plotPresets = Array.isArray(data.plotPresets) ? JSON.parse(JSON.stringify(data.plotPresets)) : [];
    // Object.assign copies references: map/object defaults must be cloned per
    // instance, otherwise seeding a category switch would write straight into
    // DEFAULT_SETTINGS and outlive the settings object.
    for (const key of ["enabledGroups", "customEnabledGroups", "shortcuts", "paramPresets"]) {
      const fallback = DEFAULT_SETTINGS[key];
      const saved = data[key];
      this.settings[key] = Object.assign({},
        fallback && typeof fallback === "object" ? fallback : {},
        saved && typeof saved === "object" ? saved : {});
    }
    this.settings.usageCounts = Object.assign({}, data.usageCounts || {});
    for (const key of ["favorites", "pinnedFormulas", "hiddenFormulas", "recentFormulas"]) {
      this.settings[key] = Array.isArray(data[key]) ? data[key].slice() : [];
    }
    log("Settings:", this.settings);
  }
  async saveSettings() { await this.saveData(this.settings); }

  addToolCommand(tool, command) {
    const { callback, checkCallback, ...definition } = command;
    this.addCommand({ ...definition, checkCallback: (checking) => {
      if (this._coreUnloaded || !isToolEnabled(this, tool)) return false;
      if (checkCallback) return checkCallback(checking);
      if (!checking) callback();
      return true;
    } });
  }

  async setToolEnabled(tool, value) {
    if (!Object.hasOwn(DEFAULT_ENABLED_TOOLS, tool) || typeof value !== "boolean") throw new Error("Invalid tool switch");
    const previous = isToolEnabled(this, tool);
    this.settings.enabledTools = { ...normalizeEnabledTools(this.settings.enabledTools), [tool]: value };
    this.refreshViews();
    try { await this.saveSettings(); }
    catch (error) {
      if (this.settings.enabledTools[tool] === value) this.settings.enabledTools[tool] = previous;
      this.refreshViews();
      throw error;
    }
  }

  async initEnabledGroups() {
    const builtin = this.settings.enabledGroups || {};
    const custom = this.settings.customEnabledGroups || {};
    let changed = false;
    for (const meta of FORMULA_INDEX.builtin) {
      if (!Object.prototype.hasOwnProperty.call(builtin, meta.id)) {
        builtin[meta.id] = true;
        changed = true;
      }
    }
    for (const meta of FORMULA_INDEX.custom) {
      if (!Object.prototype.hasOwnProperty.call(custom, meta.id)) {
        custom[meta.id] = true;
        changed = true;
      }
    }
    this.settings.enabledGroups = builtin;
    this.settings.customEnabledGroups = custom;
    if (changed) await this.saveSettings();
  }

  async reloadFormulas() {
    log("reloadFormulas: before, enabledGroups=", JSON.stringify(this.settings.enabledGroups));
    const ok = await loadFormulas(this);
    if (ok && FORMULA_DATA) {
      log("reloadFormulas: after, groups:", FORMULA_DATA.GROUPS.length, "ids:", FORMULA_DATA.GROUPS.map(function(g) { return g.id; }));
      this.refreshViews();
    }
  }

  trackOpenModal(modal) {
    if (!this._editorModals) this._editorModals = new Set();
    this._editorModals.add(modal);
  }

  untrackOpenModal(modal) {
    if (this._editorModals) this._editorModals.delete(modal);
  }

  // Pushes setting changes into the sidebar and every open editor modal so the
  // library updates without reopening the editor or reloading the plugin.
  refreshViews() {
    if (!isToolEnabled(this, "conversion")) {
      for (const modal of this._conversionModals || []) modal.close();
      const service = this._coreService;
      this._coreService = null;
      service?.dispose().catch((error) => logWarn("Core cleanup failed:", error.code || error.message));
    }
    const leaves = this.app.workspace.getLeavesOfType("formula-library-sidebar");
    for (const leaf of leaves) {
      if (leaf.view && leaf.view.renderTabs) {
        try { leaf.view.refreshLocalization?.(); leaf.view.renderTabs(); leaf.view.renderList(); } catch (e) { logWarn("refresh sidebar failed:", e.message); }
      }
    }
    for (const modal of Array.from(this._editorModals || [])) {
      try { modal.refreshLibrary(); } catch (e) { logWarn("refresh modal failed:", e.message); }
    }
    for (const modal of this._conversionModals || []) modal.refreshLocalization();
  }

  // Folder paths are typed character by character: reload once typing stops.
  debouncedReload() {
    if (this._reloadTimer) window.clearTimeout(this._reloadTimer);
    this._reloadTimer = window.setTimeout(() => {
      this._reloadTimer = null;
      this.reloadFormulas();
    }, 600);
  }

  getFormulaAtCursor() {
    const v = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!v) { logWarn("getFormulaAtCursor: no MarkdownView"); return null; }
    const ed = v.editor, full = ed.getValue(), pos = ed.posToOffset(ed.getCursor());
    for (const [re, display] of [[/\$\$([\s\S]+?)\$\$/g, true], [/\$([^$\n]+?)\$/g, false]]) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(full)) !== null) {
        const s = m.index + (re.source.startsWith("\\$\\$") ? 2 : 1);
        if (pos >= s && pos <= s + m[1].length) return { latex: m[1].trim(), start: m.index, end: m.index + m[0].length, display };
      }
    }
    return null;
  }

  findMarkdownEditor() {
    if (this._activeEditor) return this._activeEditor;

    let v = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (v && v.editor) return v.editor;

    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      if (leaf.view instanceof obsidian.MarkdownView && leaf.view.editor) {
        log("Found editor from markdown leaf");
        return leaf.view.editor;
      }
    }
    return null;
  }

  openEditor(mode, latex, formulaInfo) {
    const ed = this.findMarkdownEditor();
    log("openEditor: mode=" + mode + ", editor=" + !!ed + ", latex=" + (latex || "").slice(0, 50));
    if (!ed) {
      new obsidian.Notice(ui(this, "noEditor"));
      return;
    }
    const modal = new EditorModal(this.app, this, mode || "insert", latex || "", formulaInfo || null);
    modal.open();
    return modal;
  }

  openDrawing(source, drawingInfo) {
    if (!isToolEnabled(this, "mermaid")) return null;
    if (!this.findMarkdownEditor()) {
      new obsidian.Notice(ui(this, "noEditor"));
      return;
    }
    const modal = new DrawingModal(this.app, this, { source: source || "", drawingInfo: drawingInfo || null });
    modal.open();
    return modal;
  }

  // Named-parameter templates: ``#name#`` tokens are filled from a small form.
  // ``onInsert`` lets the formula editor feed the result into its own field.
  openParamTemplates(onInsert) {
    if (!isToolEnabled(this, "templates")) return null;
    const modal = new ParamTemplateModal(this.app, this, { onInsert: typeof onInsert === "function" ? onInsert : null });
    modal.open();
    return modal;
  }

  openMatrixPaste(onInsert) {
    if (!isToolEnabled(this, "matrix")) return null;
    const modal = new MatrixPasteModal(this.app, this, { onInsert: typeof onInsert === "function" ? onInsert : null });
    modal.open();
    return modal;
  }

  openFunctionPlot() {
    if (!isToolEnabled(this, "plot")) return null;
    const modal = new PlotFunctionModal(this.app, this, {});
    modal.open();
    return modal;
  }

  openFormulaDetails(item) { new FormulaDetailsModal(this.app, this, item).open(); }
  openWorkspaceBackup() { const modal = new WorkspaceBackupModal(this.app, this); modal.open(); return modal; }

  getCoreConversionService() {
    if (!isToolEnabled(this, "conversion")) throw new CoreConversionError("CORE_DISABLED", "Format conversion is disabled in settings.");
    if (this._coreUnloaded) throw new CoreConversionError("CORE_DISPOSED", "The plugin has been unloaded.");
    if (!this._coreService || this._coreService.disposed) {
      this._coreService = new CoreConversionService({ createSession: createBundledCoreSession });
    }
    return this._coreService;
  }

  openConversion(options = {}) {
    if (!isToolEnabled(this, "conversion")) return null;
    if (this._coreUnloaded) return null;
    const modal = new FormulaConversionModal(this.app, this, options);
    modal.open();
    return modal;
  }

  insertPlotSvg(svg, config, plotInfo, editorOverride) {
    const editor = editorOverride || this.findMarkdownEditor();
    if (!editor) {
      new obsidian.Notice(ui(this, "noEditor"));
      return false;
    }
    const markup = String(svg || "").trim();
    if (!markup) return false;
    const cursor = editor.getCursor();
    const content = (config ? plotConfigComment(config) + "\n" : "") + markup;
    if (plotInfo) {
      if (editor.getValue().slice(plotInfo.start, plotInfo.end) !== plotInfo.original) {
        new obsidian.Notice("The plot changed in the note. Reopen it before updating.");
        return false;
      }
      editor.replaceRange(content, editor.offsetToPos(plotInfo.start), editor.offsetToPos(plotInfo.end));
      editor.focus(); return true;
    }
    const block = "\n" + content + "\n\n";
    editor.replaceRange(block, cursor);
    editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor) + block.length));
    editor.focus();
    return true;
  }

  async insertPlotFile(svg, folder, config) {
    const editor = this.findMarkdownEditor();
    if (!editor) {
      new obsidian.Notice(ui(this, "noEditor"));
      return false;
    }
    const adapter = managerAdapter(this);
    const markup = String(svg || "").trim();
    if (!adapter || !markup) return false;
    const dir = normalizeFolderPath(folder) || "plots";
    if (dir.split("/").some((part) => part === "." || part === ".." || part.startsWith(".")) || /^\/|^[a-z]:|\\/i.test(dir)) {
      new obsidian.Notice("Use an image folder inside the vault"); return false;
    }
    try {
      const parts = dir.split("/").filter(Boolean);
      let current = "";
      for (const part of parts) {
        current = current ? current + "/" + part : part;
        if (!(await adapter.exists(current))) await adapter.mkdir(current);
      }
      const path = dir + "/" + plotFileName("function");
      await adapter.write(path, '<?xml version="1.0" encoding="UTF-8"?>\n' + markup + "\n");
      const cursor = editor.getCursor();
      const block = "\n" + (config ? plotConfigComment(config) + "\n" : "") + "![[" + path + "]]\n\n";
      editor.replaceRange(block, cursor);
      editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor) + block.length));
      editor.focus();
      new obsidian.Notice(ui(this, "plotInserted"));
      return true;
    } catch (error) {
      logWarn("insertPlotFile failed:", error.message);
      new obsidian.Notice(ui(this, "plotInsertFailed"));
      return false;
    }
  }

  // Find the ```mermaid block the cursor sits in, so an existing diagram can be
  // edited in place instead of being re-inserted as a new block.
  getDrawingAtCursor(editorOverride) {
    let ed = editorOverride || null;
    if (!ed) {
      const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      if (!view || !view.editor) { logWarn("getDrawingAtCursor: no MarkdownView"); return null; }
      ed = view.editor;
    }
    const info = findMermaidBlockAt(ed.getValue(), ed.posToOffset(ed.getCursor()));
    return info ? { source: info.source, start: info.start, end: info.end } : null;
  }

  replaceDrawing(source, drawingInfo) {
    const editor = this.findMarkdownEditor();
    if (!editor || !drawingInfo) {
      this.insertDrawing(source);
      return;
    }
    const block = "```mermaid\n" + String(source || "").trim() + "\n```";
    editor.replaceRange(block, editor.offsetToPos(drawingInfo.start), editor.offsetToPos(drawingInfo.end));
    editor.setCursor(editor.offsetToPos(drawingInfo.start + block.length));
    editor.focus();
  }

  insertDrawing(source) {
    const editor = this.findMarkdownEditor();
    if (!editor) {
      new obsidian.Notice(ui(this, "noEditor"));
      return;
    }
    const cursor = editor.getCursor();
    const block = "```mermaid\n" + String(source || "").trim() + "\n```\n";
    editor.replaceRange(block, cursor);
    editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor) + block.length));
    editor.focus();
  }

  toggleSidebar() {
    const ex = this.app.workspace.getLeavesOfType("formula-library-sidebar");
    if (ex.length) { log("Sidebar already open, revealing"); this.app.workspace.revealLeaf(ex[0]); return; }
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (!leaf) { logErr("toggleSidebar: no left leaf"); return; }
    leaf.setViewState({ type: "formula-library-sidebar", active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  insertFormula(latex, _display) {
    const ed = this.findMarkdownEditor();
    if (!ed) { logErr("insertFormula: no editor found"); new obsidian.Notice(ui(this, "noEditor")); return false; }
    trackUsage(this, latex);
    const fmt = this.settings.insertFormat || "display";
    const w = fmt === "inline" ? "$" : "$$";
    const cur = ed.getCursor(), startOffset = ed.posToOffset(cur), t = w + latex + w;
    log("insertFormula: format=" + fmt + ", len=" + t.length);
    ed.replaceRange(t, cur);
    const ph = latex.indexOf("#?");
    if (ph >= 0) {
      const offset = startOffset + w.length + ph;
      ed.setSelection(ed.offsetToPos(offset), ed.offsetToPos(offset + 2));
    } else {
      ed.setCursor(ed.offsetToPos(startOffset + t.length));
    }
    ed.focus();
    return true;
  }

  replaceFormula(latex, formulaInfo) {
    const editor = this.findMarkdownEditor();
    if (!editor || !formulaInfo) {
      return this.insertFormula(latex, true);
    }
    trackUsage(this, latex);
    const wrapper = formulaInfo.display ? "$$" : "$";
    const replacement = wrapper + latex + wrapper;
    const start = editor.offsetToPos(formulaInfo.start);
    const end = editor.offsetToPos(formulaInfo.end);
    editor.replaceRange(replacement, start, end);
    editor.setCursor(editor.offsetToPos(formulaInfo.start + replacement.length));
    editor.focus();
    return true;
  }
}

export { FormulaLibraryPlugin };
