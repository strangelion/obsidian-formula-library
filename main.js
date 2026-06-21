/*
 * Obsidian Formula Library Plugin
 * Based on LaTeXSnipper Office Plugin formula library
 */
"use strict";

const obsidian = require("obsidian");

let FORMULA_DATA = null;
let mathliveReady = false;

const DEFAULT_SETTINGS = {
  locale: "auto",
  insertFormat: "display",
  defaultEditorMode: "visual",
  mathliveKeyboard: true,
  formulasPath: "formulas",
  previewFontSize: 20,
  mathFontStyle: "italic",
  mathFontFamily: "",
};
const LOG_PREFIX = "[FormulaLib]";
const UI_STRINGS = {
  en: { title: "Formula Editor", visual: "Visual", source: "Source", search: "Search all formulas ...", preview: "Type LaTeX below", noEditor: "No active editor", openEditor: "Open Editor", editMode: "Edit mode", cancel: "Cancel", acceptInsert: "Insert", acceptUpdate: "Update", ready: "Ready" },
  zh: { title: "公式编辑器", visual: "可视化", source: "源码", search: "搜索所有公式 ...", preview: "在下方输入 LaTeX", noEditor: "没有活动的编辑器", openEditor: "打开编辑器", editMode: "编辑模式", cancel: "取消", acceptInsert: "插入", acceptUpdate: "更新", ready: "就绪" },
};

const MATHLIVE_ZH = {
  "keyboard.tooltip.symbols": "符号",
  "keyboard.tooltip.greek": "希腊字母",
  "keyboard.tooltip.numeric": "数字",
  "keyboard.tooltip.alphabetic": "罗马字母",
  "tooltip.copy to clipboard": "复制到剪贴板",
  "tooltip.cut to clipboard": "剪切到剪贴板",
  "tooltip.paste from clipboard": "从剪贴板粘贴",
  "tooltip.redo": "重做",
  "tooltip.toggle virtual keyboard": "切换虚拟键盘",
  "tooltip.menu": "菜单",
  "tooltip.undo": "撤销",
  "menu.borders": "矩阵边框",
  "menu.insert matrix": "插入矩阵",
  "menu.array.add row above": "上方添加行",
  "menu.array.add row below": "下方添加行",
  "menu.array.add column after": "右侧添加列",
  "menu.array.add column before": "左侧添加列",
  "menu.array.delete row": "删除行",
  "menu.array.delete rows": "删除选中行",
  "menu.array.delete column": "删除列",
  "menu.array.delete columns": "删除选中列",
  "menu.mode": "模式",
  "menu.mode-math": "数学",
  "menu.mode-text": "文本",
  "menu.mode-latex": "LaTeX",
  "menu.insert": "插入",
  "menu.insert.abs": "绝对值",
  "menu.insert.nth-root": "n 次根号",
  "menu.insert.log-base": "对数 (log)",
  "menu.insert.heading-calculus": "微积分",
  "menu.insert.derivative": "导数",
  "menu.insert.nth-derivative": "n 阶导数",
  "menu.insert.integral": "积分",
  "menu.insert.sum": "求和",
  "menu.insert.product": "乘积",
  "menu.insert.heading-complex-numbers": "复数",
  "menu.insert.modulus": "模",
  "menu.insert.argument": "辐角",
  "menu.insert.real-part": "实部",
  "menu.insert.imaginary-part": "虚部",
  "menu.insert.conjugate": "共轭",
  "tooltip.blackboard": "黑板粗体",
  "tooltip.bold": "粗体",
  "tooltip.italic": "斜体",
  "tooltip.fraktur": "哥特体",
  "tooltip.script": "手写体",
  "tooltip.caligraphic": "书法体",
  "tooltip.typewriter": "等宽",
  "tooltip.roman-upright": "罗马正体",
  "tooltip.row-by-col": "%@ × %@",
  "menu.font-style": "字体风格",
  "menu.accent": "重音/修饰",
  "menu.decoration": "装饰",
  "menu.color": "颜色",
  "menu.background-color": "背景",
  "menu.evaluate": "计算",
  "menu.simplify": "化简",
  "menu.solve": "求解",
  "menu.solve-for": "求解 %@",
  "menu.cut": "剪切",
  "menu.copy": "复制",
  "menu.copy-as-latex": "复制为 LaTeX",
  "menu.copy-as-typst": "复制为 Typst",
  "menu.copy-as-ascii-math": "复制为 ASCII Math",
  "menu.copy-as-mathml": "复制为 MathML",
  "menu.paste": "粘贴",
  "menu.select-all": "全选",
  "color.red": "红色",
  "color.orange": "橙色",
  "color.yellow": "黄色",
  "color.lime": "青柠色",
  "color.green": "绿色",
  "color.teal": "蓝绿色",
  "color.cyan": "青色",
  "color.blue": "蓝色",
  "color.indigo": "靛蓝色",
  "color.purple": "紫色",
  "color.magenta": "品红色",
  "color.black": "黑色",
  "color.dark-grey": "深灰色",
  "color.grey": "灰色",
  "color.light-grey": "浅灰色",
  "color.white": "白色",
};

function log(...args) { console.log(LOG_PREFIX, ...args); }
function logWarn(...args) { console.warn(LOG_PREFIX, ...args); }
function logErr(...args) { console.error(LOG_PREFIX, ...args); }

function loc(plugin) {
  return (plugin.settings?.locale === "auto" ? navigator.language : plugin.settings.locale).startsWith("zh") ? "zh" : "en";
}
function ui(plugin, key) {
  const lang = loc(plugin);
  return (UI_STRINGS[lang] && UI_STRINGS[lang][key]) || UI_STRINGS.en[key] || key;
}
function tabName(plugin, g) {
  return (FORMULA_DATA.STRINGS[loc(plugin)] || FORMULA_DATA.STRINGS.en).tabs[g.id] || g.id;
}
function itemLabel(plugin, i) {
  return loc(plugin) === "zh" ? i[0] : (i[2] || i[0]);
}

function loadBundledFallback() {
  try {
    FORMULA_DATA = require("./formulas/_bundled.js");
    log("Loaded bundled fallback data");
    return true;
  } catch (e) {
    logErr("Failed to load bundled fallback:", e.message);
    return false;
  }
}

async function loadFormulas(plugin) {
  try {
    const adapter = plugin.app.vault.adapter;
    const pluginDir = ".obsidian/plugins/" + plugin.manifest.id;
    const formulasDir = pluginDir + "/formulas";

    let order = null;
    try {
      const indexJson = await adapter.read(formulasDir + "/_index.json");
      order = JSON.parse(indexJson).order;
    } catch (_) {
      log("_index.json not found, will auto-discover groups");
    }

    let STRINGS = null;
    try {
      const stringsJson = await adapter.read(formulasDir + "/_strings.json");
      STRINGS = JSON.parse(stringsJson);
    } catch (_) {
      logWarn("_strings.json not found, using empty strings");
      STRINGS = { en: { tabs: {} }, zh: { tabs: {} } };
    }

    let fileNames;
    if (order) {
      fileNames = order.map(function(id) { return id + ".json"; });
    } else {
      const allFiles = await adapter.list(formulasDir);
      fileNames = (allFiles.files || [])
        .map(function(p) { return p.split("/").pop() || p.split("\\").pop(); })
        .filter(function(n) { return n.endsWith(".json") && !n.startsWith("_"); });
      fileNames.sort();
    }

    const GROUPS = [];
    for (const fileName of fileNames) {
      try {
        const content = await adapter.read(formulasDir + "/" + fileName);
        const group = JSON.parse(content);
        if (group && group.id && Array.isArray(group.items)) {
          GROUPS.push(group);
        }
      } catch (e) {
        logWarn("Failed to load " + fileName + ":", e.message);
      }
    }

    if (GROUPS.length === 0) {
      log("No groups loaded from files, trying bundled fallback");
      return loadBundledFallback();
    }

    FORMULA_DATA = { STRINGS: STRINGS, GROUPS: GROUPS };
    log("Loaded " + GROUPS.length + " groups from formulas/ folder");
    return true;
  } catch (e) {
    logWarn("loadFormulas from files failed:", e.message, "- trying bundled fallback");
    return loadBundledFallback();
  }
}

function loadMathLive() {
  if (mathliveReady) return Promise.resolve();
  return new Promise((resolve) => {
    if (window.MathfieldElement) { mathliveReady = true; resolve(); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/mathlive@0.104.0/dist/mathlive-static.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mathlive@0.104.0/dist/mathlive.min.js";
    s.onload = () => { mathliveReady = true; log("MathLive loaded"); resolve(); };
    s.onerror = () => { logWarn("MathLive load failed"); resolve(); };
    document.head.appendChild(s);
  });
}

// ======================== Settings Tab ========================
class FormulaLibrarySettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Formula Library Settings" });

    new obsidian.Setting(containerEl)
      .setName("Language / 语言")
      .setDesc("UI language. 'auto' follows Obsidian setting.")
      .addDropdown((d) => d
        .addOption("auto", "Auto")
        .addOption("zh", "中文")
        .addOption("en", "English")
        .setValue(this.plugin.settings.locale)
        .onChange(async (v) => { this.plugin.settings.locale = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Insert format / 插入格式")
      .setDesc("How formulas are wrapped when inserted into the editor.")
      .addDropdown((d) => d
        .addOption("display", "Display $$...$$ (block)")
        .addOption("inline", "Inline $...$")
        .setValue(this.plugin.settings.insertFormat)
        .onChange(async (v) => { this.plugin.settings.insertFormat = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Default editor mode / 默认编辑器模式")
      .setDesc("Whether the formula editor opens in visual or source mode.")
      .addDropdown((d) => d
        .addOption("visual", "Visual (MathLive)")
        .addOption("source", "Source (LaTeX)")
        .setValue(this.plugin.settings.defaultEditorMode)
        .onChange(async (v) => { this.plugin.settings.defaultEditorMode = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("MathLive virtual keyboard / MathLive 虚拟键盘")
      .setDesc("Enable MathLive virtual keyboard in visual mode.")
      .addToggle((t) => t
        .setValue(this.plugin.settings.mathliveKeyboard)
        .onChange(async (v) => { this.plugin.settings.mathliveKeyboard = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Formulas folder / 公式文件夹")
      .setDesc("Path to the formulas folder relative to the plugin directory.")
      .addText((t) => t
        .setPlaceholder("formulas")
        .setValue(this.plugin.settings.formulasPath)
        .onChange(async (v) => { this.plugin.settings.formulasPath = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Preview font size / 预览字体大小")
      .setDesc("Font size (px) for the MathLive editor in visual mode.")
      .addSlider((s) => s
        .setLimits(12, 40, 1)
        .setValue(this.plugin.settings.previewFontSize)
        .setDynamicTooltip()
        .onChange(async (v) => { this.plugin.settings.previewFontSize = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Math font style / 数学字体样式")
      .setDesc("Italic (default) or upright math rendering.")
      .addDropdown((d) => d
        .addOption("italic", "Italic (斜体)")
        .addOption("upright", "Upright (正体)")
        .setValue(this.plugin.settings.mathFontStyle)
        .onChange(async (v) => { this.plugin.settings.mathFontStyle = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName("Custom font family / 自定义字体")
      .setDesc("Override math font. Leave empty for KaTeX default. Examples: 'Times New Roman', 'Cambria Math', 'STIX Two Math'.")
      .addText((t) => t
        .setPlaceholder("KaTeX (default)")
        .setValue(this.plugin.settings.mathFontFamily)
        .onChange(async (v) => { this.plugin.settings.mathFontFamily = v; await this.plugin.saveSettings(); }));
  }
}

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

    loadMathLive();

    this._activeEditor = null;

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
    this.addCommand({
      id: "edit-at-cursor", name: "Edit Formula at Cursor",
      checkCallback: (c) => { const i = this.getFormulaAtCursor(); if (i) { if (!c) { log("Command: edit-at-cursor, latex:", i.latex); this.openEditor("update", i.latex); } return true; } return false; },
    });
    this.addCommand({ id: "toggle-sidebar", name: "Toggle Formula Library Sidebar", callback: () => { log("Command: toggle-sidebar"); this.toggleSidebar(); } });
    log("Loaded OK");
  }

  onunload() {
    log("Unloading");
    try {
      this.app.workspace.detachLeavesOfType("formula-library-sidebar");
    } catch (e) {
      logWarn("detachLeaves failed:", e.message);
    }
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); log("Settings:", this.settings); }

  getFormulaAtCursor() {
    const v = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!v) { logWarn("getFormulaAtCursor: no MarkdownView"); return null; }
    const ed = v.editor, full = ed.getValue(), pos = ed.posToOffset(ed.getCursor());
    for (const re of [/\$\$([\s\S]+?)\$\$/g, /\$([^$\n]+?)\$/g]) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(full)) !== null) {
        const s = m.index + (re.source.startsWith("\\$\\$") ? 2 : 1);
        if (pos > s && pos < s + m[1].length) return { latex: m[1].trim(), start: m.index, end: m.index + m[0].length };
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

  openEditor(mode, latex) {
    const ed = this.findMarkdownEditor();
    log("openEditor: mode=" + mode + ", editor=" + !!ed + ", latex=" + (latex || "").slice(0, 50));
    new EditorModal(this.app, this, mode || "insert", latex || "").open();
  }

  toggleSidebar() {
    const ex = this.app.workspace.getLeavesOfType("formula-library-sidebar");
    if (ex.length) { log("Sidebar already open, revealing"); this.app.workspace.revealLeaf(ex[0]); return; }
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (!leaf) { logErr("toggleSidebar: no left leaf"); return; }
    leaf.setViewState({ type: "formula-library-sidebar", active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  insertFormula(latex, display) {
    const ed = this.findMarkdownEditor();
    if (!ed) { logErr("insertFormula: no editor found"); new obsidian.Notice(ui(this, "noEditor")); return; }
    const fmt = this.settings.insertFormat || "display";
    const w = fmt === "inline" ? "$" : "$$";
    const cur = ed.getCursor(), t = w + latex + w;
    log("insertFormula: format=" + fmt + ", len=" + t.length);
    ed.replaceRange(t, cur);
    const ph = latex.indexOf("#?");
    if (ph >= 0) {
      const pos = { line: cur.line, ch: cur.ch + w.length + ph };
      ed.setSelection(pos, { line: pos.line, ch: pos.ch + 2 });
    } else {
      ed.setCursor({ line: cur.line, ch: cur.ch + t.length });
    }
    ed.focus();
  }
}

// ======================== Sidebar (simplified) ========================
class SidebarView extends obsidian.ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.currentGroup = null; this.globalQ = ""; }
  getViewType() { return "formula-library-sidebar"; }
  getDisplayText() { return "Formula Library"; }
  getIcon() { return "sigma"; }

  async onOpen() {
    log("Sidebar onOpen");
    if (!FORMULA_DATA) { logErr("Sidebar: no data"); return; }
    this.currentGroup = FORMULA_DATA.GROUPS[0];
    const c = this.containerEl.children[1]; c.empty(); c.addClass("formula-library-sidebar");

    const sc = c.createDiv({ cls: "fl-search-container" });
    const si = sc.createEl("input", { cls: "fl-search-input", attr: { type: "text", placeholder: ui(this.plugin, "search") } });
    si.addEventListener("input", () => { this.globalQ = si.value; this.renderList(); });

    this.tabsEl = c.createDiv({ cls: "fl-tabs" });
    this.listEl = c.createDiv({ cls: "fl-list" });

    const bar = c.createDiv({ cls: "fl-action-bar" });
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(this.plugin, "openEditor") })
      .addEventListener("click", () => {
        this.plugin.openEditor("insert");
      });

    this.renderTabs(); this.renderList();
  }

  renderTabs() {
    this.tabsEl.empty();
    for (const g of FORMULA_DATA.GROUPS) {
      const b = this.tabsEl.createEl("button", { cls: "fl-tab", text: tabName(this.plugin, g) });
      if (this.currentGroup && g.id === this.currentGroup.id) b.addClass("active");
      b.addEventListener("click", () => { this.currentGroup = g; this.renderTabs(); this.renderList(); });
    }
  }

  renderList() {
    this.listEl.empty();
    const q = this.globalQ.trim().toLowerCase();
    if (q) {
      for (const g of FORMULA_DATA.GROUPS) {
        const hits = g.items.filter(i => !i.section && (itemLabel(this.plugin, i).toLowerCase().includes(q) || i[1].toLowerCase().includes(q)));
        if (!hits.length) continue;
        this.listEl.createDiv({ cls: "fl-section-label" }).textContent = tabName(this.plugin, g);
        hits.forEach(i => this.listEl.appendChild(this.makeItem(i)));
      }
    } else if (this.currentGroup) {
      for (const i of this.currentGroup.items) {
        if (i.section) { this.listEl.createDiv({ cls: "fl-section-label" }).textContent = loc(this.plugin) === "zh" ? i.section : i.sectionEn; continue; }
        this.listEl.appendChild(this.makeItem(i));
      }
    }
  }

  makeItem(i) {
    const label = itemLabel(this.plugin, i);
    const b = document.createElement("button");
    b.className = "fl-list-item";
    b.title = i[2] ? i[2] + "\n" + i[1] : i[1];
    b.textContent = label + "  " + i[1];
    b.addEventListener("click", (e) => {
      e.preventDefault();
      let ed = this.plugin.findMarkdownEditor();
      if (!ed) { logErr("Sidebar: no editor"); new obsidian.Notice(ui(this.plugin, "noEditor")); return; }
      const fmt = this.plugin.settings.insertFormat || "display";
      const w = fmt === "inline" ? "$" : "$$";
      const cur = ed.getCursor(), t = w + i[1] + w;
      ed.replaceRange(t, cur);
      const ph = i[1].indexOf("#?");
      if (ph >= 0) {
        const pos = { line: cur.line, ch: cur.ch + w.length + ph };
        ed.setSelection(pos, { line: pos.line, ch: pos.ch + 2 });
      } else {
        ed.setCursor({ line: cur.line, ch: cur.ch + t.length });
      }
      ed.focus();
    });
    return b;
  }

  async onClose() { log("Sidebar onClose"); }
}

// ======================== Editor Modal ========================
class EditorModal extends obsidian.Modal {
  constructor(app, plugin, mode, latex) {
    super(app);
    this.plugin = plugin;
    this.initMode = mode;
    this.initLatex = latex;
  }

  async onOpen() {
    log("Modal onOpen, mode=" + this.initMode);

    const container = this.containerEl;
    const modal = container.querySelector(".modal");
    if (modal) {
      modal.style.width = "min(1600px, 96vw)";
      modal.style.height = "min(900px, 94vh)";
      modal.style.maxWidth = "96vw";
      modal.style.maxHeight = "94vh";
    }
    container.style.width = "min(1600px, 96vw)";
    container.style.maxWidth = "96vw";
    container.style.height = "min(900px, 94vh)";
    container.style.maxHeight = "94vh";

    this.contentEl.addClass("formula-editor-modal");
    this.titleEl.setText(ui(this.plugin, "title"));

    const top = this.contentEl.createDiv({ cls: "fe-top-bar" });
    const tg = top.createDiv({ cls: "fe-mode-toggle" });
    this.btnV = tg.createEl("button", { text: ui(this.plugin, "visual"), cls: "active" });
    this.btnS = tg.createEl("button", { text: ui(this.plugin, "source") });
    top.createDiv({ cls: "fe-spacer" });
    top.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "cancel") }).addEventListener("click", () => this.close());
    this.btnAccept = top.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(this.plugin, "acceptInsert") });
    this.btnAccept.addEventListener("click", () => this.accept());

    const ml = this.contentEl.createDiv({ cls: "fe-main-layout" });
    const ep = ml.createDiv({ cls: "fe-editor-pane" });

    this.visualPane = ep.createDiv({ cls: "fe-visual-pane" });
    this.previewEl = this.visualPane.createDiv({ cls: "fe-preview-area" });

    this.sourcePane = ep.createDiv({ cls: "fe-source-pane" });
    this.sourceTA = this.sourcePane.createEl("textarea", { cls: "fe-textarea", attr: { spellcheck: "false", placeholder: "Enter LaTeX..." } });

    if (this.plugin.settings.defaultEditorMode === "source") {
      this.visualPane.style.display = "none";
      this.sourcePane.style.display = "";
      this.btnS.addClass("active");
      this.btnV.removeClass("active");
    } else {
      this.sourcePane.style.display = "none";
    }

    this.statusEl = ep.createDiv({ cls: "fe-status-bar" });
    this.statusEl.setText(ui(this.plugin, "ready"));

    const lp = ml.createDiv({ cls: "fe-library-panel" });
    const lc = lp.createDiv({ cls: "fl-search-container" });
    this.libSI = lc.createEl("input", { cls: "fl-search-input", attr: { type: "text", placeholder: ui(this.plugin, "search") } });
    this.libSI.addEventListener("input", () => this.renderLibGrid());
    this.libTabs = lp.createDiv({ cls: "fl-tabs" });
    this.libGrid = lp.createDiv({ cls: "fl-grid-scroll" }).createDiv({ cls: "fl-grid" });
    this.libCurG = FORMULA_DATA.GROUPS[0];
    this.renderLibTabs(); this.renderLibGrid();

    await loadMathLive();

    if (window.MathfieldElement) {
      try { MathfieldElement.fontsDirectory = "https://cdn.jsdelivr.net/npm/mathlive@0.104.0/dist/fonts"; } catch (_) {}
      if (loc(this.plugin) === "zh") {
        try { MathfieldElement.strings = { "zh-CN": MATHLIVE_ZH }; } catch (_) {}
        try { MathfieldElement.locale = "zh-CN"; } catch (_) {}
      }
      this.mf = new MathfieldElement();
      this.mf.mathVirtualKeyboardPolicy = this.plugin.settings.mathliveKeyboard ? "auto" : "manual";
      this.mf.smartFence = true;
      this.mf.style.width = "100%";
      this.mf.style.minHeight = "120px";
      this.mf.style.fontSize = (this.plugin.settings.previewFontSize || 20) + "px";
      this.mf.style.border = "none";
      this.mf.style.background = "transparent";
      this.mf.style.padding = "0";
      this.mf.style.userSelect = "text";
      this.mf.style.webkitUserSelect = "text";
      this.mf.style.pointerEvents = "auto";
      if (this.plugin.settings.mathFontStyle === "upright") {
        this.mf.style.setProperty("--math-font-style", "upright");
      }
      if (this.plugin.settings.mathFontFamily) {
        this.mf.style.setProperty("--math-font-family", this.plugin.settings.mathFontFamily);
      }
      this.previewEl.appendChild(this.mf);

      ["mousedown", "mouseup", "mousemove", "click", "dblclick"].forEach((evt) => {
        this.mf.addEventListener(evt, (e) => e.stopPropagation(), true);
      });

      this.mf.addEventListener("input", () => {
        const val = this.mf.value || "";
        this.sourceTA.value = val;
      });

      if (this.initLatex) this.mf.value = this.initLatex;
    } else {
      this.previewEl.createEl("div", { cls: "fe-preview-placeholder", text: "MathLive unavailable" });
    }

    this.ta = this.visualPane.createEl("textarea", { cls: "fe-textarea", attr: { spellcheck: "false", placeholder: "Enter LaTeX here..." } });
    this.ta.style.display = "none";

    this.sourceTA.addEventListener("input", () => {
      if (this.mf) this.mf.value = this.sourceTA.value;
    });

    this.btnV.addEventListener("click", () => {
      this.btnV.addClass("active"); this.btnS.removeClass("active");
      this.visualPane.style.display = ""; this.sourcePane.style.display = "none";
    });
    this.btnS.addEventListener("click", () => {
      this.btnS.addClass("active"); this.btnV.removeClass("active");
      this.visualPane.style.display = "none"; this.sourcePane.style.display = "";
      this.sourceTA.value = this.mf ? this.mf.getValue("latex") : this.ta.value;
    });
    [this.sourceTA].forEach(el => el.addEventListener("keydown", (e) => this.onKey(e)));

    this.btnAccept.setText(this.initMode === "update" ? ui(this.plugin, "acceptUpdate") : ui(this.plugin, "acceptInsert"));
    this.statusEl.setText(this.initMode === "update" ? ui(this.plugin, "editMode") : ui(this.plugin, "ready"));
  }

  renderLibTabs() {
    this.libTabs.empty();
    for (const g of FORMULA_DATA.GROUPS) {
      const b = this.libTabs.createEl("button", { cls: "fl-tab", text: tabName(this.plugin, g) });
      if (this.libCurG && g.id === this.libCurG.id) b.addClass("active");
      b.addEventListener("click", () => { this.libCurG = g; this.renderLibTabs(); this.renderLibGrid(); });
    }
  }

  renderLibGrid() {
    this.libGrid.empty();
    const q = this.libSI?.value?.trim()?.toLowerCase() || "";
    if (q) {
      this.libGrid.className = "fl-grid structures";
      for (const g of FORMULA_DATA.GROUPS) {
        const hits = g.items.filter(i => !i.section && (itemLabel(this.plugin, i).toLowerCase().includes(q) || i[1].toLowerCase().includes(q)));
        if (!hits.length) continue;
        this.libGrid.createDiv({ cls: "fl-group-label" }).textContent = tabName(this.plugin, g);
        hits.forEach(i => this.libGrid.appendChild(this.makeLibBtn(i)));
      }
    } else if (this.libCurG) {
      this.libGrid.className = this.libCurG.structures ? "fl-grid structures" : "fl-grid";
      for (const i of this.libCurG.items) {
        if (i.section) { this.libGrid.createDiv({ cls: "fl-section-label" }).textContent = loc(this.plugin) === "zh" ? i.section : i.sectionEn; continue; }
        this.libGrid.appendChild(this.makeLibBtn(i));
      }
    }
  }

  makeLibBtn(i) {
    const label = itemLabel(this.plugin, i);
    const latex = i[1];
    const b = document.createElement("button");
    b.className = "fl-symbol-btn";

    b.createDiv({ cls: "fl-sym-label", text: label });
    b.createEl("code", { cls: "fl-sym-fallback", text: latex.length > 28 ? latex.slice(0, 26) + "..." : latex });
    b.title = i[2] ? i[2] + "\n" + latex : latex;

    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.insertIntoEditor(latex);
    });

    return b;
  }

  insertIntoEditor(latex) {
    if (latex.startsWith("matrix:")) latex = this.matrixTemplate(latex.slice(7));
    if (this.mf) {
      const mlLatex = latex.replace(/#\?/g, "\\square").replace(/#0/g, "\\square").replace(/#@/g, "\\square");
      this.mf.insert(mlLatex);
      this.sourceTA.value = this.mf.value || "";
      this.mf.focus();
    } else {
      const s = this.ta.selectionStart, end = this.ta.selectionEnd, t = this.ta.value;
      this.ta.value = t.slice(0, s) + latex + t.slice(end);
      const ph = latex.indexOf("#?");
      if (ph >= 0) {
        this.ta.selectionStart = s + ph;
        this.ta.selectionEnd = s + ph + 2;
      } else {
        this.ta.selectionStart = this.ta.selectionEnd = s + latex.length;
      }
      this.ta.focus();
      this.sourceTA.value = this.ta.value;
    }
  }

  matrixTemplate(env) {
    const R = 2, C = 2;
    const cells = (r, c, fn) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => fn(i, j)).join(" & ")).join(" \\\\ ");
    if (env === "jacobian") return `\\begin{bmatrix} ${cells(R, C, (r, c) => `\\frac{\\partial f_{${r+1}}}{\\partial x_{${c+1}}}`)} \\end{bmatrix}`;
    if (env === "hessian") return `\\begin{bmatrix} ${cells(R, C, (r, c) => `\\frac{\\partial^2 f}{\\partial x_{${r+1}}\\partial x_{${c+1}}}`)} \\end{bmatrix}`;
    if (env === "identity") return `\\begin{bmatrix} ${cells(R, R, (r, c) => r === c ? "1" : "0")} \\end{bmatrix}`;
    if (env === "diagonal") return `\\begin{bmatrix} ${cells(R, R, (r, c) => r === c ? `a_{${r+1}}` : "0")} \\end{bmatrix}`;
    if (env === "augmented") return `\\left[\\begin{array}{cc|c} ${cells(R, C + 1, () => "#?")} \\end{array}\\right]`;
    return `\\begin{${env}} ${cells(env === "cases" ? R : R, env === "cases" ? 2 : C, () => "#?")} \\end{${env}}`;
  }

  cleanLatex(latex) {
    if (latex.startsWith("matrix:")) return "\\text{" + latex.slice(7) + "}";
    return latex.replace(/#\?/g, "\\square").replace(/#0/g, "\\square").replace(/#@/g, "\\square");
  }

  renderMath(el, latex) {
    if (!el || !latex) return;
    try {
      const cleaned = this.cleanLatex(latex);
      const rendered = obsidian.renderMath(cleaned, el);
      if (rendered) el.appendChild(rendered);
    } catch (e) {
      logWarn("renderMath failed:", e.message);
    }
  }

  updatePreview() {
    if (this.mf) {
      this.mf.setValue(this.ta.value);
    }
  }

  onKey(e) {
    if (e.key === "Enter" && e.shiftKey && !e.isComposing && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); this.accept();
    }
  }

  accept() {
    const latex = this.mf ? (this.mf.value || "").trim() : this.ta.value.trim();
    if (!latex) { this.statusEl.setText("Please enter a formula"); return; }
    log("accept: inserting into editor");
    this.plugin.insertFormula(latex, true);
    this.close();
  }

  onClose() { log("Modal onClose"); this.contentEl.empty(); }
}

module.exports = FormulaLibraryPlugin;
