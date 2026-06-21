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
  enabledGroups: {},
};
const LOG_PREFIX = "[FormulaLib]";
const UI_STRINGS = {
  en: {
    title: "Formula Editor", visual: "Visual", source: "Source", search: "Search all formulas ...", preview: "Type LaTeX below", noEditor: "No active editor", openEditor: "Open Editor", editMode: "Edit mode", cancel: "Cancel", acceptInsert: "Insert", acceptUpdate: "Update", ready: "Ready",
    settingsTitle: "Formula Library Settings",
    language: "Language", languageDesc: "UI language. 'auto' follows Obsidian setting.",
    insertFormat: "Insert format", insertFormatDesc: "How formulas are wrapped when inserted.",
    defaultMode: "Default editor mode", defaultModeDesc: "Visual or source mode on open.",
    mathliveKbd: "MathLive virtual keyboard", mathliveKbdDesc: "Enable virtual keyboard in visual mode.",
    formulasFolder: "Formulas folder", formulasFolderDesc: "Path to formulas folder relative to plugin directory.",
    fontSize: "Preview font size", fontSizeDesc: "Font size (px) for MathLive editor.",
    fontStyle: "Math font style", fontStyleDesc: "Italic (default) or upright math rendering.",
    fontFamily: "Custom font family", fontFamilyDesc: "Override math font. Leave empty for KaTeX default.",
    groupsTitle: "Formula Groups", groupsDesc: "Toggle which groups are visible. Add JSON files to formulas/ then click Refresh.",
    refreshBtn: "Refresh", refreshDesc: "Detect new formula files and reload.",
    enableAll: "Enable all", enableAllDesc: "When enabled, all groups are shown regardless of individual toggles below.",
  },
  zh: {
    title: "公式编辑器", visual: "可视化", source: "源码", search: "搜索所有公式 ...", preview: "在下方输入 LaTeX", noEditor: "没有活动的编辑器", openEditor: "打开编辑器", editMode: "编辑模式", cancel: "取消", acceptInsert: "插入", acceptUpdate: "更新", ready: "就绪",
    settingsTitle: "Formula Library 设置",
    language: "语言", languageDesc: "界面语言，auto 跟随 Obsidian 设置。",
    insertFormat: "插入格式", insertFormatDesc: "公式插入时的包裹方式。",
    defaultMode: "默认编辑器模式", defaultModeDesc: "打开编辑器时默认可视化或源码。",
    mathliveKbd: "MathLive 虚拟键盘", mathliveKbdDesc: "可视化模式下启用虚拟键盘。",
    formulasFolder: "公式文件夹", formulasFolderDesc: "公式文件相对插件目录的路径。",
    fontSize: "预览字体大小", fontSizeDesc: "MathLive 编辑器字号 (px)。",
    fontStyle: "数学字体样式", fontStyleDesc: "斜体（默认）或正体渲染。",
    fontFamily: "自定义字体", fontFamilyDesc: "覆盖数学字体，留空使用 KaTeX 默认。",
    groupsTitle: "公式分类", groupsDesc: "切换哪些分类可见。放入 JSON 文件后点击刷新。",
    refreshBtn: "刷新", refreshDesc: "检测新公式文件并重新加载。",
    enableAll: "全部启用", enableAllDesc: "启用后忽略下方的单独开关。",
  },
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

const SEARCH_ALIASES = {
  frac: ["分数", "fraction"], sqrt: ["根号", "平方根", "square root"],
  lim: ["极限", "limit"], int: ["积分", "integral"], sum: ["求和", "summation"],
  prod: ["求积", "product"], vec: ["向量", "vector"], dot: ["点乘", "dot"],
  cross: ["叉乘", "cross"], hat: ["帽", "hat"], bar: ["划线", "bar"],
  overline: ["上划线"], underline: ["下划线"], tilde: ["波浪", "tilde"],
  sin: ["正弦", "sine"], cos: ["余弦", "cosine"], tan: ["正切", "tangent"],
  cot: ["余切", "cotangent"], sec: ["正割", "secant"], csc: ["余割", "cosecant"],
  arcsin: ["反正弦"], arccos: ["反余弦"], arctan: ["反正切"],
  sinh: ["双曲正弦"], cosh: ["双曲余弦"], tanh: ["双曲正切"],
  log: ["对数", "logarithm"], ln: ["自然对数"], exp: ["指数", "exponential"],
  max: ["最大值", "maximum"], min: ["最小值", "minimum"],
  sup: ["上确界"], inf: ["下确界"],
  alpha: ["阿尔法"], beta: ["贝塔"], gamma: ["伽马"], delta: ["德尔塔"],
  epsilon: ["艾普西隆"], theta: ["西塔"], lambda: ["拉姆达"],
  mu: ["缪"], pi: ["派"], sigma: ["西格玛"], phi: ["斐"],
  omega: ["欧米伽"], rho: ["柔"], tau: ["陶"], kappa: ["卡帕"],
  xi: ["克西"], eta: ["艾塔"], zeta: ["泽塔"], psi: ["普西"],
  Gamma: ["大伽马"], Delta: ["大德尔塔"], Theta: ["大西塔"],
  Lambda: ["大拉姆达"], Pi: ["大派"], Sigma: ["大西格玛"],
  Phi: ["大斐"], Psi: ["大普西"], Omega: ["大欧米伽"],
  matrix: ["矩阵", "matrix"], bmatrix: ["方括号矩阵"],
  pmatrix: ["圆括号矩阵"], cases: ["分段", "cases"],
  det: ["行列式", "determinant"], trace: ["迹", "trace"],
  rank: ["秩", "rank"], inverse: ["逆", "inverse"],
  eigen: ["特征", "eigen"], diagonal: ["对角", "diagonal"],
  transpose: ["转置", "transpose"], conjugate: ["共轭", "conjugate"],
  gradient: ["梯度", "gradient"], divergence: ["散度", "divergence"],
  curl: ["旋度", "curl"], laplacian: ["拉普拉斯", "laplacian"],
  nabla: ["纳布拉", "nabla"], partial: ["偏导", "partial"],
  infty: ["无穷", "infinity"], emptyset: ["空集", "empty set"],
  forall: ["任意", "for all"], exists: ["存在", "exists"],
  land: ["逻辑与", "and"], lor: ["逻辑或", "or"], neg: ["非", "not"],
  leq: ["小于等于"], geq: ["大于等于"], neq: ["不等于"],
  approx: ["约等于", "approximately"], equiv: ["恒等于"],
  subset: ["子集", "subset"], supset: ["超集", "superset"],
  cup: ["并集", "union"], cap: ["交集", "intersection"],
  in: ["属于", "element of"], ni: ["包含"],
  leftarrow: ["左箭头"], rightarrow: ["右箭头"],
 Rightarrow: ["推出", "implies"], Leftrightarrow: ["等价", "iff"],
  pm: ["正负", "plus minus"], mp: ["负正"],
  cdot: ["点乘"], times: ["叉乘", "times"], div: ["除", "divide"],
  binom: ["组合数", "binomial"], choose: ["组合"],
  text: ["文本", "text"], mathbf: ["粗体", "bold"],
  mathbb: ["黑板粗体", "blackboard"], mathcal: ["书法体", "caligraphic"],
  mathfrak: ["哥特体", "fraktur"], mathit: ["斜体", "italic"],
  operatorname: ["运算符名"],
};

function pinyinInitials(str) {
  const map = {
    "分":"f","数":"s","极":"j","限":"x","积":"j","分":"f","求":"q","和":"h",
    "矩":"j","阵":"z","向":"x","量":"l","特":"t","征":"z","值":"z","行":"h",
    "列":"l","式":"s","秩":"z","逆":"n","转":"z","置":"z","梯":"t","度":"d",
    "散":"s","旋":"x","拉":"l","普":"p","斯":"s","无":"w","穷":"q","空":"k",
    "集":"j","属":"s","于":"y","并":"b","交":"j","子":"z","超":"c","非":"f",
    "对":"d","数":"s","指":"z","正":"z","余":"y","切":"q","双":"s","曲":"q",
    "反":"f","自":"z","然":"r","最":"z","大":"d","上":"s","确":"q","界":"j",
    "矩":"j","阵":"z","分":"f","段":"d","行":"h","列":"l","迹":"j","转":"z",
    "共":"g","轭":"e","偏":"p","导":"d","欧":"o","米":"m","伽":"j","马":"m",
    "阿":"a","尔":"e","贝":"b","塔":"t","德":"d","西":"x","斐":"f","陶":"t",
    "卡":"k","克":"k","艾":"a","泽":"z","普":"p","柔":"r","派":"p","格":"g",
    "拉":"l","推":"t","出":"c","等":"d","价":"j","正":"z","负":"f","约":"y",
    "等":"d","恒":"h","属":"s","包":"b","含":"h","左":"z","右":"y","箭":"j",
    "头":"t","逻":"l","辑":"j","与":"y","或":"h","不":"b","非":"f",
    "粗":"c","黑":"h","板":"b","书":"s","法":"f","哥":"g","特":"t",
    "组":"z","合":"h","文":"w","本":"b","运":"y","算":"s","符":"f",
    "点":"d","乘":"c","叉":"c","除":"c","正":"z","负":"f",
    "微":"w","分":"f","三":"s","角":"j","函":"h","数":"s",
    "几":"j","何":"h","代":"d","数":"s","概":"g","率":"l",
    "物":"w","理":"l","化":"h","学":"x","概":"g","率":"l",
  };
  let r = "";
  for (const ch of str) { if (map[ch]) r += map[ch]; }
  return r;
}

function smartMatch(query, item, plugin) {
  const q = query.toLowerCase();
  const label = itemLabel(plugin, item).toLowerCase();
  const latex = (item[1] || "").toLowerCase();
  const enLabel = (item[2] || "").toLowerCase();

  if (label.includes(q) || latex.includes(q) || enLabel.includes(q)) return true;

  const py = pinyinInitials(query);
  if (py.length >= 2 && (label.includes(py) || enLabel.includes(py))) return true;

  for (const [cmd, aliases] of Object.entries(SEARCH_ALIASES)) {
    if (q.includes(cmd) || cmd.includes(q)) {
      for (const a of aliases) {
        if (label.includes(a.toLowerCase()) || enLabel.includes(a.toLowerCase()) || latex.includes("\\" + cmd)) return true;
      }
    }
  }

  if (q.length >= 2) {
    let pi = 0;
    for (let i = 0; i < label.length && pi < q.length; i++) {
      if (label[i] === q[pi]) pi++;
    }
    if (pi === q.length) return true;
  }

  return false;
}

async function loadBundledFallback(plugin) {
  try {
    const adapter = plugin.app.vault.adapter;
    const pluginDir = ".obsidian/plugins/" + plugin.manifest.id;
    const content = await adapter.read(pluginDir + "/formulas/_bundled.js");
    const jsonStr = content.replace("module.exports = ", "").replace(/;$/, "");
    const data = JSON.parse(jsonStr);
    if (data && data.GROUPS && data.GROUPS.length) {
      FORMULA_DATA = data;
      log("Loaded bundled fallback data,", data.GROUPS.length, "groups");
      return true;
    }
  } catch (e) {
    logWarn("Bundled fallback not available:", e.message);
  }
  logErr("No formula data available");
  return false;
}

async function loadFormulas(plugin) {
  try {
    const adapter = plugin.app.vault.adapter;
    const pluginDir = ".obsidian/plugins/" + plugin.manifest.id;
    const formulasDir = pluginDir + "/" + (plugin.settings.formulasPath || "formulas");

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

    const enabled = plugin.settings.enabledGroups || {};

    const GROUPS = [];
    for (const fileName of fileNames) {
      try {
        const content = await adapter.read(formulasDir + "/" + fileName);
        const group = JSON.parse(content);
        if (group && group.id && Array.isArray(group.items)) {
          if (enabled[group.id] === false) {
            log("Skipped disabled group:", group.id);
            continue;
          }
          GROUPS.push(group);
        }
      } catch (e) {
        logWarn("Failed to load " + fileName + ":", e.message);
      }
    }

    if (GROUPS.length === 0) {
      const hasDisabled = Object.values(enabled).some(function(v) { return v === false; });
      if (hasDisabled) {
        log("All groups disabled by user");
        FORMULA_DATA = { STRINGS: STRINGS || { en: { tabs: {} }, zh: { tabs: {} } }, GROUPS: [] };
        return true;
      }
      log("No groups loaded, trying bundled fallback");
      return await loadBundledFallback(plugin);
    }

    FORMULA_DATA = { STRINGS: STRINGS, GROUPS: GROUPS };
    log("Loaded " + GROUPS.length + " groups from formulas/ folder");
    return true;
  } catch (e) {
    logWarn("loadFormulas from files failed:", e.message, "- trying bundled fallback");
    return await loadBundledFallback(plugin);
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

  async display() {
    const { containerEl } = this;
    containerEl.empty();
    const p = this.plugin;
    containerEl.createEl("h2", { text: ui(p, "settingsTitle") });

    new obsidian.Setting(containerEl)
      .setName(ui(p, "language"))
      .setDesc(ui(p, "languageDesc"))
      .addDropdown((d) => d
        .addOption("auto", "Auto")
        .addOption("zh", "中文")
        .addOption("en", "English")
        .setValue(p.settings.locale)
        .onChange(async (v) => { p.settings.locale = v; await p.saveSettings(); this.display(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "insertFormat"))
      .setDesc(ui(p, "insertFormatDesc"))
      .addDropdown((d) => d
        .addOption("display", "$$...$$")
        .addOption("inline", "$...$")
        .setValue(p.settings.insertFormat)
        .onChange(async (v) => { p.settings.insertFormat = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "defaultMode"))
      .setDesc(ui(p, "defaultModeDesc"))
      .addDropdown((d) => d
        .addOption("visual", "Visual (MathLive)")
        .addOption("source", "Source (LaTeX)")
        .setValue(p.settings.defaultEditorMode)
        .onChange(async (v) => { p.settings.defaultEditorMode = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "mathliveKbd"))
      .setDesc(ui(p, "mathliveKbdDesc"))
      .addToggle((t) => t
        .setValue(p.settings.mathliveKeyboard)
        .onChange(async (v) => { p.settings.mathliveKeyboard = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "formulasFolder"))
      .setDesc(ui(p, "formulasFolderDesc"))
      .addText((t) => t
        .setPlaceholder("formulas")
        .setValue(p.settings.formulasPath)
        .onChange(async (v) => { p.settings.formulasPath = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontSize"))
      .setDesc(ui(p, "fontSizeDesc"))
      .addSlider((s) => s
        .setLimits(12, 40, 1)
        .setValue(p.settings.previewFontSize)
        .setDynamicTooltip()
        .onChange(async (v) => { p.settings.previewFontSize = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontStyle"))
      .setDesc(ui(p, "fontStyleDesc"))
      .addDropdown((d) => d
        .addOption("italic", "Italic")
        .addOption("upright", "Upright")
        .setValue(p.settings.mathFontStyle)
        .onChange(async (v) => { p.settings.mathFontStyle = v; await p.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName(ui(p, "fontFamily"))
      .setDesc(ui(p, "fontFamilyDesc"))
      .addText((t) => t
        .setPlaceholder("KaTeX")
        .setValue(p.settings.mathFontFamily)
        .onChange(async (v) => { p.settings.mathFontFamily = v; await p.saveSettings(); }));

    await this.renderGroupToggles(containerEl);
  }

  async renderGroupToggles(containerEl) {
    const p = this.plugin;
    containerEl.createEl("h3", { text: ui(p, "groupsTitle") });
    containerEl.createEl("p", { text: ui(p, "groupsDesc"), cls: "setting-item-description" });

    new obsidian.Setting(containerEl)
      .setName(ui(p, "refreshBtn"))
      .setDesc(ui(p, "refreshDesc"))
      .addButton((btn) => btn
        .setButtonText(ui(p, "refreshBtn"))
        .setCta()
        .onClick(async () => {
          await p.reloadFormulas();
          this.display();
        }));

    const adapter = this.plugin.app.vault.adapter;
    const pluginDir = ".obsidian/plugins/" + this.plugin.manifest.id;
    const formulasDir = pluginDir + "/" + (this.plugin.settings.formulasPath || "formulas");

    let files = [];
    try {
      const allFiles = await adapter.list(formulasDir);
      files = (allFiles.files || [])
        .map((p) => p.split("/").pop() || p.split("\\").pop())
        .filter((n) => n.endsWith(".json") && !n.startsWith("_"));
    } catch (e) {
      containerEl.createEl("p", { text: "Could not read formulas folder: " + e.message, cls: "setting-item-description" });
      return;
    }

    if (files.length === 0) {
      containerEl.createEl("p", { text: "No formula files found in " + formulasDir, cls: "setting-item-description" });
      return;
    }

    const enabled = this.plugin.settings.enabledGroups;
    const allEnabled = files.every((f) => enabled[f.replace(".json", "")] !== false);

    new obsidian.Setting(containerEl)
      .setName(ui(p, "enableAll"))
      .setDesc(ui(p, "enableAllDesc"))
      .addToggle((t) => t
        .setValue(allEnabled)
        .onChange(async (v) => {
          for (const f of files) {
            this.plugin.settings.enabledGroups[f.replace(".json", "")] = v;
          }
          await this.plugin.saveSettings();
          await this.plugin.reloadFormulas();
          this.display();
        }));

    for (const file of files) {
      const groupId = file.replace(".json", "");
      let groupLabel = groupId;
      let itemCount = 0;

      try {
        const content = await adapter.read(formulasDir + "/" + file);
        const group = JSON.parse(content);
        if (group) {
          itemCount = (group.items || []).length;
          if (group.id) groupLabel = group.id;
        }
      } catch (_) {}

      const isOn = allEnabled || enabled[groupId] !== false;

      new obsidian.Setting(containerEl)
        .setName(groupLabel + " (" + itemCount + ")")
        .setDesc(file)
        .addToggle((t) => t
          .setValue(isOn)
          .onChange(async (v) => {
            log("Toggle " + groupId + " → " + v);
            this.plugin.settings.enabledGroups[groupId] = v;
            await this.plugin.saveSettings();
            log("Saved enabledGroups:", JSON.stringify(this.plugin.settings.enabledGroups));
            await this.plugin.reloadFormulas();
          }));
    }
  }
}

// ======================== Plugin ========================
class FormulaLibraryPlugin extends obsidian.Plugin {
  async onload() {
    log("Loading...");
    await this.loadSettings();
    await this.initEnabledGroups();

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
  async saveSettings() { await this.saveData(this.settings); }

  async initEnabledGroups() {
    const enabled = this.settings.enabledGroups || {};
    if (Object.keys(enabled).length > 0) return;
    const adapter = this.app.vault.adapter;
    const pluginDir = ".obsidian/plugins/" + this.manifest.id;
    const formulasDir = pluginDir + "/" + (this.settings.formulasPath || "formulas");
    try {
      const allFiles = await adapter.list(formulasDir);
      const files = (allFiles.files || [])
        .map((p) => p.split("/").pop() || p.split("\\").pop())
        .filter((n) => n.endsWith(".json") && !n.startsWith("_"));
      for (const f of files) {
        enabled[f.replace(".json", "")] = true;
      }
      this.settings.enabledGroups = enabled;
      await this.saveSettings();
    } catch (_) {}
  }

  async reloadFormulas() {
    log("reloadFormulas: before, enabledGroups=", JSON.stringify(this.settings.enabledGroups));
    const ok = await loadFormulas(this);
    if (ok && FORMULA_DATA) {
      log("reloadFormulas: after, groups:", FORMULA_DATA.GROUPS.length, "ids:", FORMULA_DATA.GROUPS.map(function(g) { return g.id; }));
      const leaves = this.app.workspace.getLeavesOfType("formula-library-sidebar");
      for (const leaf of leaves) {
        if (leaf.view && leaf.view.renderTabs) {
          try { leaf.view.renderTabs(); leaf.view.renderList(); } catch (e) { logWarn("refresh sidebar failed:", e.message); }
        }
      }
    }
  }

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

    const isZh = loc(this.plugin) === "zh";
    const hint = sc.createDiv({ cls: "fl-search-hint" });
    hint.createEl("span", { text: isZh ? "支持: 拼音首字母 · LaTeX命令( frac sqrt lim ) · 模糊匹配" : "Smart: pinyin initials · LaTeX commands (frac sqrt lim) · fuzzy match", cls: "fl-search-hint-text" });

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
    if (!FORMULA_DATA.GROUPS.length) {
      this.tabsEl.createEl("span", { text: loc(this.plugin) === "zh" ? "没有启用的分类" : "No enabled groups", cls: "fl-tab" });
      return;
    }
    for (const g of FORMULA_DATA.GROUPS) {
      const b = this.tabsEl.createEl("button", { cls: "fl-tab", text: tabName(this.plugin, g) });
      if (this.currentGroup && g.id === this.currentGroup.id) b.addClass("active");
      b.addEventListener("click", () => { this.currentGroup = g; this.renderTabs(); this.renderList(); });
    }
  }

  renderList() {
    this.listEl.empty();
    const q = this.globalQ.trim();
    if (q) {
      for (const g of FORMULA_DATA.GROUPS) {
        const hits = g.items.filter(i => !i.section && smartMatch(q, i, this.plugin));
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
    const hintZh = loc(this.plugin) === "zh";
    lc.createDiv({ cls: "fl-search-hint" }).createEl("span", { text: hintZh ? "拼音首字母 · frac sqrt lim · 模糊" : "pinyin · frac sqrt lim · fuzzy", cls: "fl-search-hint-text" });
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
    const q = this.libSI?.value?.trim() || "";
    if (q) {
      this.libGrid.className = "fl-grid structures";
      for (const g of FORMULA_DATA.GROUPS) {
        const hits = g.items.filter(i => !i.section && smartMatch(q, i, this.plugin));
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
