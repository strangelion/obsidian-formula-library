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

// ======================== Plugin ========================
class FormulaLibraryPlugin extends obsidian.Plugin {
  async onload() {
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
    this.addCommand({ id: "open-mermaid-diagram", name: "Open Mermaid Diagram Editor", callback: () => this.openDrawing() });
    this.addCommand({ id: "open-param-templates", name: "Insert Parameterized Formula", callback: () => { log("Command: open-param-templates"); this.openParamTemplates(); } });
    this.addCommand({ id: "paste-matrix-data", name: "Paste Matrix Data", callback: () => { log("Command: paste-matrix-data"); this.openMatrixPaste(); } });
    this.addCommand({ id: "plot-function", name: "Plot Function", callback: () => { log("Command: plot-function"); this.openFunctionPlot(); } });
    this.addCommand({
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
    log("Unloading");
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
    this.settings.customParamTemplates = Array.isArray(data.customParamTemplates) ? JSON.parse(JSON.stringify(data.customParamTemplates)) : [];
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
    const leaves = this.app.workspace.getLeavesOfType("formula-library-sidebar");
    for (const leaf of leaves) {
      if (leaf.view && leaf.view.renderTabs) {
        try { leaf.view.refreshLocalization?.(); leaf.view.renderTabs(); leaf.view.renderList(); } catch (e) { logWarn("refresh sidebar failed:", e.message); }
      }
    }
    for (const modal of Array.from(this._editorModals || [])) {
      try { modal.refreshLibrary(); } catch (e) { logWarn("refresh modal failed:", e.message); }
    }
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
    const modal = new ParamTemplateModal(this.app, this, { onInsert: typeof onInsert === "function" ? onInsert : null });
    modal.open();
    return modal;
  }

  openMatrixPaste(onInsert) {
    const modal = new MatrixPasteModal(this.app, this, { onInsert: typeof onInsert === "function" ? onInsert : null });
    modal.open();
    return modal;
  }

  openFunctionPlot() {
    const modal = new PlotFunctionModal(this.app, this, {});
    modal.open();
    return modal;
  }

  insertPlotSvg(svg) {
    const editor = this.findMarkdownEditor();
    if (!editor) {
      new obsidian.Notice(ui(this, "noEditor"));
      return false;
    }
    const markup = String(svg || "").trim();
    if (!markup) return false;
    const cursor = editor.getCursor();
    const block = "\n" + markup + "\n\n";
    editor.replaceRange(block, cursor);
    editor.setCursor(editor.offsetToPos(editor.posToOffset(cursor) + block.length));
    editor.focus();
    return true;
  }

  async insertPlotFile(svg, folder) {
    const editor = this.findMarkdownEditor();
    if (!editor) {
      new obsidian.Notice(ui(this, "noEditor"));
      return false;
    }
    const adapter = managerAdapter(this);
    const markup = String(svg || "").trim();
    if (!adapter || !markup) return false;
    const dir = normalizeFolderPath(folder) || "plots";
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
      const block = "\n![[" + path + "]]\n\n";
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
    if (!ed) { logErr("insertFormula: no editor found"); new obsidian.Notice(ui(this, "noEditor")); return; }
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
  }

  replaceFormula(latex, formulaInfo) {
    const editor = this.findMarkdownEditor();
    if (!editor || !formulaInfo) {
      this.insertFormula(latex, true);
      return;
    }
    trackUsage(this, latex);
    const wrapper = formulaInfo.display ? "$$" : "$";
    const replacement = wrapper + latex + wrapper;
    const start = editor.offsetToPos(formulaInfo.start);
    const end = editor.offsetToPos(formulaInfo.end);
    editor.replaceRange(replacement, start, end);
    editor.setCursor(editor.offsetToPos(formulaInfo.start + replacement.length));
    editor.focus();
  }
}

export { FormulaLibraryPlugin };
