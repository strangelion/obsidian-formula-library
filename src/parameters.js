import * as obsidian from "obsidian";
import { labelControl, runModalAction } from "./ui.js";
import { log, logWarn, loc, ui } from "./core.js";
import { validateLatex } from "./custom-library.js";

// ==================== Parameterized formula templates ====================
// Named-parameter templates: every `#name#` token is filled from a small form, so
// the library can offer "quadratic roots" instead of a skeleton full of `#?`.
// Table rule: never put a literal digit right before a token and never write two
// tokens back to back - use \cdot, otherwise numeric values merge (`4ac` -> `423`).
const PARAM_TEMPLATES = [
  {
    key: "quadratic-roots",
    name: "一元二次方程求根",
    nameEn: "Quadratic roots",
    latex: "x = \\frac{-#b# \\pm \\sqrt{#b#^{2} - 4 \\cdot #a# \\cdot #c#}}{2 \\cdot #a#}",
    params: [
      { name: "a", label: "二次项系数 a", labelEn: "Quadratic coefficient a", value: "a" },
      { name: "b", label: "一次项系数 b", labelEn: "Linear coefficient b", value: "b" },
      { name: "c", label: "常数项 c", labelEn: "Constant term c", value: "c" },
    ],
  },
  {
    key: "parabola",
    name: "抛物线（一般式）",
    nameEn: "Parabola (general form)",
    latex: "y = #a#x^{2} + #b#x + #c#",
    params: [
      { name: "a", label: "二次项系数 a", labelEn: "Quadratic coefficient a", value: "a" },
      { name: "b", label: "一次项系数 b", labelEn: "Linear coefficient b", value: "b" },
      { name: "c", label: "常数项 c", labelEn: "Constant term c", value: "c" },
    ],
  },
  {
    key: "vertex-form",
    name: "抛物线（顶点式）",
    nameEn: "Parabola (vertex form)",
    latex: "y = #a#\\left(x - #h#\\right)^{2} + #k#",
    params: [
      { name: "a", label: "开口系数 a", labelEn: "Leading coefficient a", value: "a" },
      { name: "h", label: "顶点横坐标 h", labelEn: "Vertex offset h", value: "h" },
      { name: "k", label: "顶点纵坐标 k", labelEn: "Vertex offset k", value: "k" },
    ],
  },
  {
    key: "line",
    name: "一次函数",
    nameEn: "Linear function",
    latex: "y = #k#x + #b#",
    params: [
      { name: "k", label: "斜率 k", labelEn: "Slope k", value: "k" },
      { name: "b", label: "截距 b", labelEn: "Intercept b", value: "b" },
    ],
  },
  {
    key: "sum",
    name: "求和",
    nameEn: "Sum",
    latex: "\\sum_{#i# = #m#}^{#n#} #a#_{#i#}",
    params: [
      { name: "i", label: "求和指标 i", labelEn: "Index i", value: "i" },
      { name: "m", label: "下界 m", labelEn: "Lower limit m", value: "1" },
      { name: "n", label: "上界 n", labelEn: "Upper limit n", value: "n" },
      { name: "a", label: "通项 a", labelEn: "Term a", value: "a" },
    ],
  },
  {
    key: "product",
    name: "连乘",
    nameEn: "Product",
    latex: "\\prod_{#i# = #m#}^{#n#} #a#_{#i#}",
    params: [
      { name: "i", label: "连乘指标 i", labelEn: "Index i", value: "i" },
      { name: "m", label: "下界 m", labelEn: "Lower limit m", value: "1" },
      { name: "n", label: "上界 n", labelEn: "Upper limit n", value: "n" },
      { name: "a", label: "通项 a", labelEn: "Term a", value: "a" },
    ],
  },
  {
    key: "integral",
    name: "定积分",
    nameEn: "Definite integral",
    latex: "\\int_{#a#}^{#b#} #f#\\left(#x#\\right) \\, d#x#",
    params: [
      { name: "a", label: "下限 a", labelEn: "Lower limit a", value: "0" },
      { name: "b", label: "上限 b", labelEn: "Upper limit b", value: "1" },
      { name: "f", label: "被积函数 f", labelEn: "Integrand f", value: "f" },
      { name: "x", label: "积分变量 x", labelEn: "Variable x", value: "x" },
    ],
  },
  {
    key: "limit",
    name: "极限",
    nameEn: "Limit",
    latex: "\\lim_{#x# \\to #a#} #f#\\left(#x#\\right)",
    params: [
      { name: "x", label: "自变量 x", labelEn: "Variable x", value: "x" },
      { name: "a", label: "趋近值 a", labelEn: "Approach point a", value: "a" },
      { name: "f", label: "函数 f", labelEn: "Function f", value: "f" },
    ],
  },
  {
    key: "derivative",
    name: "导数",
    nameEn: "Derivative",
    latex: "\\frac{d}{d#x#} #f#\\left(#x#\\right)",
    params: [
      { name: "x", label: "自变量 x", labelEn: "Variable x", value: "x" },
      { name: "f", label: "函数 f", labelEn: "Function f", value: "f" },
    ],
  },
  {
    key: "partial-derivative",
    name: "偏导数",
    nameEn: "Partial derivative",
    latex: "\\frac{\\partial #f#}{\\partial #x#}",
    params: [
      { name: "f", label: "函数 f", labelEn: "Function f", value: "f" },
      { name: "x", label: "自变量 x", labelEn: "Variable x", value: "x" },
    ],
  },
  {
    key: "sqrt-n",
    name: "n 次方根",
    nameEn: "nth root",
    latex: "\\sqrt[#n#]{#x#}",
    params: [
      { name: "n", label: "次数 n", labelEn: "Degree n", value: "n" },
      { name: "x", label: "被开方数 x", labelEn: "Radicand x", value: "x" },
    ],
  },
  {
    key: "binomial",
    name: "二项式系数",
    nameEn: "Binomial coefficient",
    latex: "\\binom{#n#}{#k#} = \\frac{#n#!}{#k#! \\left(#n# - #k#\\right)!}",
    params: [
      { name: "n", label: "总数 n", labelEn: "Total n", value: "n" },
      { name: "k", label: "选取数 k", labelEn: "Chosen k", value: "k" },
    ],
  },
  {
    key: "determinant-2x2",
    name: "二阶行列式",
    nameEn: "2x2 determinant",
    latex: "\\begin{vmatrix} #a# & #b# \\\\ #c# & #d# \\end{vmatrix} = #a# \\cdot #d# - #b# \\cdot #c#",
    params: [
      { name: "a", label: "元素 a", labelEn: "Entry a", value: "a" },
      { name: "b", label: "元素 b", labelEn: "Entry b", value: "b" },
      { name: "c", label: "元素 c", labelEn: "Entry c", value: "c" },
      { name: "d", label: "元素 d", labelEn: "Entry d", value: "d" },
    ],
  },
  {
    key: "normal-distribution",
    name: "正态分布密度",
    nameEn: "Normal density",
    latex: "f\\left(#x#\\right) = \\frac{1}{#sigma#\\sqrt{2\\pi}} e^{-\\frac{\\left(#x# - #mu#\\right)^{2}}{2 \\cdot #sigma#^{2}}}",
    params: [
      { name: "x", label: "取值 x", labelEn: "Value x", value: "x" },
      { name: "mu", label: "均值 μ", labelEn: "Mean", value: "\\mu" },
      { name: "sigma", label: "标准差 σ", labelEn: "Std deviation", value: "\\sigma" },
    ],
  },
  {
    key: "taylor",
    name: "泰勒展开",
    nameEn: "Taylor expansion",
    latex: "#f#\\left(#x#\\right) = \\sum_{#n# = 0}^{\\infty} \\frac{#f#^{\\left(#n#\\right)}\\left(#a#\\right)}{#n#!} \\left(#x# - #a#\\right)^{#n#}",
    params: [
      { name: "f", label: "函数 f", labelEn: "Function f", value: "f" },
      { name: "x", label: "自变量 x", labelEn: "Variable x", value: "x" },
      { name: "a", label: "展开点 a", labelEn: "Expansion point a", value: "0" },
      { name: "n", label: "阶数 n", labelEn: "Order n", value: "n" },
    ],
  },
  {
    key: "uniform-acceleration",
    name: "匀变速位移（物理）",
    nameEn: "Uniform acceleration",
    latex: "s = #v0# \\cdot t + \\frac{1}{2} \\cdot #a# \\cdot t^{2}",
    params: [
      { name: "v0", label: "初速度 v₀", labelEn: "Initial velocity", value: "v_{0}" },
      { name: "a", label: "加速度 a", labelEn: "Acceleration a", value: "a" },
    ],
  },
  {
    key: "kinetic-energy",
    name: "动能（物理）",
    nameEn: "Kinetic energy",
    latex: "E_{k} = \\frac{1}{2} \\cdot #m# \\cdot #v#^{2}",
    params: [
      { name: "m", label: "质量 m", labelEn: "Mass m", value: "m" },
      { name: "v", label: "速度 v", labelEn: "Velocity v", value: "v" },
    ],
  },
  {
    key: "newton-second",
    name: "牛顿第二定律",
    nameEn: "Newton's second law",
    latex: "F = #m# \\cdot #a#",
    params: [
      { name: "m", label: "质量 m", labelEn: "Mass m", value: "m" },
      { name: "a", label: "加速度 a", labelEn: "Acceleration a", value: "a" },
    ],
  },
];

function paramTemplateTokens(latex) {
  const out = [];
  const re = /#([A-Za-z][A-Za-z0-9_]*)#|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
  let match;
  while ((match = re.exec(String(latex || "")))) {
    const name = match[1] || match[2];
    if (out.indexOf(name) < 0) out.push(name);
  }
  return out;
}

function allParamTemplates(plugin) {
  const custom = plugin?.settings?.customParamTemplates;
  return PARAM_TEMPLATES.concat(Array.isArray(custom) ? custom.filter((entry) => entry && typeof entry.key === "string" && entry.key.startsWith("custom-") && typeof entry.name === "string" && typeof entry.latex === "string" && Array.isArray(entry.params)).slice(0, 200) : []);
}

function paramTemplateByKey(key, plugin) {
  for (const template of allParamTemplates(plugin)) if (template.key === key) return template;
  return null;
}

function paramTemplateLabel(plugin, template) {
  if (!template) return "";
  return loc(plugin) === "zh" ? template.name : (template.nameEn || template.name);
}

function paramLabel(plugin, param) {
  if (!param) return "";
  return loc(plugin) === "zh" ? (param.label || param.name) : (param.labelEn || param.label || param.name);
}

// Substitutes every `#name#` token; an empty value falls back to the template default.
function renderParamTemplate(template, values) {
  if (!template) return "";
  const defaults = Object.create(null);
  for (const param of template.params || []) {
    defaults[param.name] = param.value === undefined || param.value === null ? param.name : String(param.value);
  }
  const used = values && typeof values === "object" ? values : {};
  return String(template.latex || "").replace(/#([A-Za-z][A-Za-z0-9_]*)#|\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (match, oldName, newName) => {
    const name = oldName || newName;
    const raw = Object.prototype.hasOwnProperty.call(used, name) ? used[name] : undefined;
    const value = (raw === undefined || raw === null ? "" : String(raw).trim()) || defaults[name] || name;
    // A negative value is parenthesized so it stays correct inside a power, a
    // product or after a minus sign (`-3^{2}` would otherwise mean `-(3^{2})`).
    if (/^-/.test(value)) return "\\left(" + value + "\\right)";
    return value;
  });
}

function getParamPresets(plugin, key) {
  const all = plugin && plugin.settings ? plugin.settings.paramPresets : null;
  const list = all && typeof all === "object" ? all[key] : null;
  return Array.isArray(list) ? list : [];
}

function saveParamPreset(plugin, key, name, values) {
  const clean = String(name == null ? "" : name).trim();
  if (!clean || !plugin || !plugin.settings) return getParamPresets(plugin, key);
  if (!plugin.settings.paramPresets || typeof plugin.settings.paramPresets !== "object") plugin.settings.paramPresets = {};
  const list = getParamPresets(plugin, key).filter((preset) => preset.name !== clean);
  list.unshift({ name: clean, values: Object.assign({}, values || {}), savedAt: Date.now() });
  plugin.settings.paramPresets[key] = list.slice(0, 20);
  return plugin.settings.paramPresets[key];
}

function deleteParamPreset(plugin, key, name) {
  const list = getParamPresets(plugin, key).filter((preset) => preset.name !== name);
  if (plugin && plugin.settings && plugin.settings.paramPresets) {
    if (list.length) plugin.settings.paramPresets[key] = list;
    else delete plugin.settings.paramPresets[key];
  }
  return list;
}

// A parameter may hold LaTeX, so it is validated with the same rules as a formula.
function paramValueError(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  const error = validateLatex(text);
  return error === "latexRequired" ? "" : error;
}

const mathPreviewGenerations = new WeakMap();

function renderLatexInto(el, latex, options = {}) {
  if (!el) return Promise.resolve(false);
  const generation = (mathPreviewGenerations.get(el) || 0) + 1;
  mathPreviewGenerations.set(el, generation);
  if (el.empty) el.empty();
  if (!latex) return Promise.resolve(false);
  let expired = false, timer;
  const current = () => !expired && mathPreviewGenerations.get(el) === generation
    && el.isConnected !== false && (!options.isCurrent || options.isCurrent());
  const timeoutMillis = Number.isSafeInteger(options.timeoutMillis) && options.timeoutMillis > 0
    ? Math.min(options.timeoutMillis, 10_000) : 10_000;
  const render = (async () => {
    if (typeof obsidian.loadMathJax === "function") await obsidian.loadMathJax();
    if (!current()) return false;
    const rendered = await obsidian.renderMath(latex, true);
    if (!current() || !rendered || !el.appendChild) return false;
    el.appendChild(rendered);
    if (typeof obsidian.finishRenderMath === "function") await obsidian.finishRenderMath();
    return current();
  })().catch((error) => { logWarn("math preview failed:", error.message); return false; });
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { expired = true; resolve(false); }, timeoutMillis);
  });
  return Promise.race([render, timeout]).finally(() => clearTimeout(timer));
}

class ParamTemplateModal extends obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.key = this.options.templateKey || (PARAM_TEMPLATES[0] ? PARAM_TEMPLATES[0].key : "");
    this.values = {};
  }

  onOpen() {
    this.containerEl.addClass("formula-library-modal-container");
    this.modalEl.addClass("formula-library-modal");
    this.modalEl.addClass("formula-parameter-modal");
    this.contentEl.addClass("ft-modal");
    this.titleEl.setText(ui(this.plugin, "paramTitle"));

    const top = this.contentEl.createDiv({ cls: "fe-top-bar" });
    this.templateSelect = top.createEl("select", { cls: "ft-select" });
    this.refreshTemplates();
    this.templateSelect.addEventListener("change", () => {
      this.key = this.templateSelect.value;
      this.values = {};
      this.buildForm();
      this.refreshPresets();
    });

    this.presetSelect = top.createEl("select", { cls: "ft-select" });
    this.presetSelect.addEventListener("change", () => this.applyPreset());
    this.presetNameInput = top.createEl("input", { cls: "ft-input", attr: { placeholder: ui(this.plugin, "paramPresetName") } });
    top.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "save") }).addEventListener("click", () => runModalAction(this, () => this.savePreset()));
    this.deletePresetButton = top.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "paramPresetDelete") });
    this.deletePresetButton.addEventListener("click", () => runModalAction(this, () => this.deletePreset()));
    labelControl(this.templateSelect, loc(this.plugin) === "zh" ? "公式模板" : "Formula template");
    labelControl(this.presetSelect, ui(this.plugin, "paramPreset"));
    labelControl(this.presetNameInput, ui(this.plugin, "paramPresetName"));

    const body = this.contentEl.createDiv({ cls: "ft-body" });
    const templateActions = body.createDiv({ cls: "fe-tools-bar" });
    const text = (zh, en) => loc(this.plugin) === "zh" ? zh : en;
    templateActions.createEl("button", { cls: "fe-btn", text: text("新建模板", "New template") }).addEventListener("click", () => this.editTemplate(null));
    templateActions.createEl("button", { cls: "fe-btn", text: text("复制为我的模板", "Duplicate template") }).addEventListener("click", () => this.editTemplate(this.template(), true));
    this.editTemplateButton = templateActions.createEl("button", { cls: "fe-btn", text: text("编辑我的模板", "Edit my template") });
    this.editTemplateButton.addEventListener("click", () => this.editTemplate(this.template()));
    this.deleteTemplateButton = templateActions.createEl("button", { cls: "fe-btn", text: text("删除模板", "Delete template") });
    this.deleteTemplateButton.addEventListener("click", () => this.deleteTemplate());
    body.createDiv({ cls: "ft-desc", text: ui(this.plugin, "paramDesc") });
    this.formEl = body.createDiv({ cls: "ft-form" });
    const previewWrap = body.createDiv({ cls: "ft-preview-wrap" });
    this.previewEl = previewWrap.createDiv({ cls: "ft-preview" });
    this.latexEl = body.createDiv({ cls: "ft-latex" });

    const footer = this.contentEl.createDiv({ cls: "ft-footer" });
    this.statusEl = footer.createDiv({ cls: "ft-status" });
    const actions = footer.createDiv({ cls: "ft-actions" });
    if (this.options.onInsert) {
      actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(this.plugin, "paramUseInEditor") })
        .addEventListener("click", () => this.submit(true));
    }
    actions.createEl("button", { cls: "fe-btn fe-btn-primary", text: ui(this.plugin, "paramInsert") })
      .addEventListener("click", () => this.submit(false));
    actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "paramReset") })
      .addEventListener("click", () => this.resetValues());
    actions.createEl("button", { cls: "fe-btn", text: ui(this.plugin, "cancel") })
      .addEventListener("click", () => this.close());

    this.buildForm();
    this.refreshPresets();
    log("ParamTemplateModal open, template=" + this.key);
  }

  template() {
    return paramTemplateByKey(this.key, this.plugin);
  }

  refreshTemplates() {
    this.templateSelect.empty();
    const templates = allParamTemplates(this.plugin);
    if (!templates.some((entry) => entry.key === this.key)) this.key = templates[0]?.key || "";
    for (const template of templates) {
      const group = template.key.startsWith("custom-") ? (template.category || (loc(this.plugin) === "zh" ? "我的模板" : "My templates")) + " · " : "";
      this.templateSelect.createEl("option", { value: template.key, text: group + paramTemplateLabel(this.plugin, template) });
    }
    this.templateSelect.value = this.key;
  }

  editTemplate(template, duplicate = false) {
    const modal = new CustomParamTemplateModal(this.app, this.plugin, template, duplicate, (key) => {
      if (!this.modalEl.isConnected) return;
      this.key = key;
      this.values = {};
      this.refreshTemplates();
      this.buildForm();
      this.refreshPresets();
    });
    modal.open();
    return modal;
  }

  async deleteTemplate() {
    if (!this.key.startsWith("custom-")) return;
    if (this.deleteConfirmKey !== this.key) {
      this.deleteConfirmKey = this.key;
      this.deleteTemplateButton.setText(loc(this.plugin) === "zh" ? "再次点击确认删除" : "Click again to confirm");
      return;
    }
    await runModalAction(this, async () => {
      const previous = this.plugin.settings.customParamTemplates;
      this.plugin.settings.customParamTemplates = previous.filter((entry) => entry.key !== this.key);
      try { await this.plugin.saveSettings(); } catch (error) { this.plugin.settings.customParamTemplates = previous; throw error; }
      this.values = {};
      this.refreshTemplates();
      this.buildForm();
      this.refreshPresets();
    });
    this.buildForm();
  }

  buildForm() {
    if (!this.formEl) return;
    this.formEl.empty();
    this.inputs = {};
    const template = this.template();
    this.deleteConfirmKey = null;
    if (this.editTemplateButton) this.editTemplateButton.disabled = !template?.key.startsWith("custom-");
    if (this.deleteTemplateButton) {
      this.deleteTemplateButton.disabled = !template?.key.startsWith("custom-");
      this.deleteTemplateButton.setText(loc(this.plugin) === "zh" ? "删除模板" : "Delete template");
    }
    if (!template) {
      if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramNoTemplates"));
      return;
    }
    // Fields follow the parameter table (reading order of the formula), and a
    // token the table forgot still gets a field so nothing is silently dropped.
    const defined = template.params || [];
    const names = defined.map((entry) => entry.name);
    for (const name of paramTemplateTokens(template.latex)) {
      if (names.indexOf(name) < 0) names.push(name);
    }
    for (const name of names) {
      const param = defined.find((entry) => entry.name === name) || { name: name, label: name, labelEn: name, value: name };
      const row = this.formEl.createDiv({ cls: "ft-row" });
      row.createEl("label", { cls: "ft-label", text: paramLabel(this.plugin, param) });
      const input = row.createEl("input", { cls: "ft-input", attr: { spellcheck: "false" } });
      input.setAttribute("aria-label", paramLabel(this.plugin, param));
      const current = this.values[param.name];
      input.value = current === undefined ? (param.value === undefined ? "" : param.value) : current;
      input.addEventListener("input", () => {
        this.values[param.name] = input.value;
        this.refreshPreview();
      });
      this.inputs[param.name] = input;
    }
    this.refreshPreview();
  }

  refreshPreview() {
    const latex = renderParamTemplate(this.template(), this.values);
    this.latexValue = latex;
    if (this.latexEl) this.latexEl.setText(ui(this.plugin, "paramLatex") + ": " + latex);
    renderLatexInto(this.previewEl, latex);
  }

  resetValues() {
    this.values = {};
    this.buildForm();
    if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramReset"));
  }

  refreshPresets() {
    if (!this.presetSelect) return;
    this.presetSelect.empty();
    this.presetSelect.createEl("option", { value: "", text: ui(this.plugin, "paramPresetNone") });
    const presets = getParamPresets(this.plugin, this.key);
    for (const preset of presets) {
      this.presetSelect.createEl("option", { value: preset.name, text: preset.name });
    }
    this.presetSelect.value = "";
    if (this.deletePresetButton) this.deletePresetButton.disabled = presets.length === 0;
  }

  applyPreset() {
    const name = this.presetSelect ? this.presetSelect.value : "";
    if (!name) return;
    const preset = getParamPresets(this.plugin, this.key).find((entry) => entry.name === name);
    if (!preset) return;
    this.values = Object.assign({}, preset.values || {});
    for (const [id, input] of Object.entries(this.inputs || {})) {
      input.value = this.values[id] === undefined ? "" : this.values[id];
    }
    this.refreshPreview();
    if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramPreset") + ": " + name);
  }

  async savePreset() {
    const name = this.presetNameInput ? String(this.presetNameInput.value || "").trim() : "";
    if (!name) {
      if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramPresetNameRequired"));
      return;
    }
    const values = Object.fromEntries(Object.entries(this.inputs || {}).map(([key, input]) => [key, input.value]));
    saveParamPreset(this.plugin, this.key, name, values);
    if (this.presetNameInput) this.presetNameInput.value = "";
    await this.plugin.saveSettings();
    this.refreshPresets();
    if (this.presetSelect) this.presetSelect.value = name;
    if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramPresetSaved"));
  }

  async deletePreset() {
    const name = this.presetSelect ? this.presetSelect.value : "";
    if (!name) return;
    deleteParamPreset(this.plugin, this.key, name);
    await this.plugin.saveSettings();
    this.refreshPresets();
    if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramPresetDeleted"));
  }

  submit(useInEditor) {
    const template = this.template();
    if (!template) {
      if (this.statusEl) this.statusEl.setText(ui(this.plugin, "paramNoTemplates"));
      return;
    }
    for (const param of template.params || []) {
      const error = paramValueError(this.values[param.name]);
      if (error) {
        if (this.statusEl) this.statusEl.setText(ui(this.plugin, error));
        return;
      }
    }
    const latex = renderParamTemplate(template, this.values);
    log("ParamTemplateModal insert:", template.key, latex);
    if (useInEditor && this.options.onInsert) this.options.onInsert(latex);
    else this.plugin.insertFormula(latex, true);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

function validateCustomParamTemplate(template) {
  if (!String(template.name || "").trim()) return "Template name is required / 请填写模板名称";
  if (!String(template.latex || "").trim()) return "LaTeX is required / 请填写公式";
  const names = paramTemplateTokens(template.latex);
  if (!names.length) return "Use {{name}} for at least one parameter / 请用 {{name}} 定义至少一个参数";
  if (names.length > 30) return "At most 30 parameters / 最多支持 30 个参数";
  const remainder = template.latex.replace(/\{\{[A-Za-z][A-Za-z0-9_]*\}\}/g, "x");
  if (/\{\{/.test(remainder)) return "Parameter names must start with an ASCII letter / 参数名须以英文字母开头，仅含字母、数字和下划线";
  const params = template.params || [];
  if (params.length !== names.length || new Set(params.map((entry) => entry.name)).size !== names.length || names.some((name) => !params.some((entry) => entry.name === name))) return "Parameter definitions do not match the formula / 参数定义与公式不一致";
  for (const param of params) if (paramValueError(param.value)) return "Invalid default value: " + param.name + " / 参数默认值无效";
  if (validateLatex(renderParamTemplate(template, {}))) return "Invalid LaTeX / 公式括号或结构不完整";
  return "";
}

class CustomParamTemplateModal extends obsidian.Modal {
  constructor(app, plugin, template, duplicate, onSaved) {
    super(app);
    this.plugin = plugin;
    this.initial = template;
    this.key = !duplicate && template?.key.startsWith("custom-") ? template.key : "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    this.onSaved = onSaved;
    this.paramDraft = Object.create(null);
    for (const param of template?.params || []) this.paramDraft[param.name] = { ...param, label: paramLabel(plugin, param) };
  }

  onOpen() {
    this.modalEl.addClass("formula-custom-modal");
    this.modalEl.addClass("formula-template-editor");
    const t = (zh, en) => loc(this.plugin) === "zh" ? zh : en;
    this.titleEl.setText(t("我的参数模板", "My parameter template"));
    const field = (label, value, multiline = false) => {
      const wrapper = this.contentEl.createDiv({ cls: "fl-field" });
      const control = wrapper.createEl(multiline ? "textarea" : "input", { cls: "fl-field-input", attr: { spellcheck: "false" } });
      control.value = value;
      labelControl(control, label);
      return control;
    };
    this.nameInput = field(t("模板名称", "Template name"), paramTemplateLabel(this.plugin, this.initial));
    this.categoryInput = field(t("分类（可选）", "Category (optional)"), this.initial?.category || "");
    this.latexInput = field("LaTeX", (this.initial?.latex || "y = {{a}} \\cdot x + {{b}}").replace(/#([A-Za-z][A-Za-z0-9_]*)#/g, "{{$1}}"), true);
    this.contentEl.createEl("p", { cls: "setting-item-description", text: t("用 {{a}}、{{b}} 标记参数。参数名使用英文字母、数字和下划线；默认值可填写 LaTeX。乘法请写 \\cdot，避免数字替换后连在一起。", "Mark parameters with {{a}}, {{b}}. Names use ASCII letters, digits and underscores; defaults may contain LaTeX. Use \\cdot for multiplication to keep numeric substitutions separate.") });
    this.paramsEl = this.contentEl.createDiv({ cls: "ft-form" });
    this.contentEl.createEl("div", { cls: "ft-preview-title", text: t("默认值预览", "Default-value preview") });
    this.previewEl = this.contentEl.createDiv({ cls: "ft-preview-wrap" }).createDiv({ cls: "ft-preview" });
    this.errorEl = this.contentEl.createDiv({ cls: "fl-field-error", attr: { role: "status" } });
    const bar = this.contentEl.createDiv({ cls: "fl-manage-bar" });
    bar.createEl("button", { cls: "fl-btn", text: ui(this.plugin, "cancel") }).addEventListener("click", () => this.close());
    bar.createEl("button", { cls: "fl-btn fl-btn-primary", text: ui(this.plugin, "save") }).addEventListener("click", () => runModalAction(this, () => this.save()));
    this.latexInput.addEventListener("input", () => this.buildParams());
    this.nameInput.addEventListener("input", () => this.refresh());
    this.buildParams();
  }

  buildParams() {
    this.paramsEl.empty();
    for (const name of paramTemplateTokens(this.latexInput.value).slice(0, 30)) {
      const draft = this.paramDraft[name] || (this.paramDraft[name] = { name, label: name, value: name });
      const row = this.paramsEl.createDiv({ cls: "ft-row" });
      const label = row.createEl("input", { cls: "ft-input" });
      label.value = draft.label;
      labelControl(label, (loc(this.plugin) === "zh" ? "显示名 · " : "Label · ") + name);
      const value = row.createEl("input", { cls: "ft-input", attr: { spellcheck: "false" } });
      value.value = draft.value;
      labelControl(value, (loc(this.plugin) === "zh" ? "默认值 · " : "Default · ") + name);
      label.addEventListener("input", () => { draft.label = label.value; draft.labelEn = label.value; this.refresh(); });
      value.addEventListener("input", () => { draft.value = value.value; this.refresh(); });
    }
    this.refresh();
  }

  data() {
    return { key: this.key, name: this.nameInput.value.trim(), category: this.categoryInput.value.trim(), latex: this.latexInput.value.trim(), params: paramTemplateTokens(this.latexInput.value).map((name) => ({ ...this.paramDraft[name], name })) };
  }

  refresh() {
    const data = this.data();
    // Naming is required to save, not to typeset a draft formula.
    const error = validateCustomParamTemplate({ ...data, name: data.name || "Draft" });
    this.errorEl.setText(this.errorText(error));
    if (error) this.previewEl.empty();
    else renderLatexInto(this.previewEl, renderParamTemplate(data, {}));
  }

  async save() {
    const data = this.data();
    const error = validateCustomParamTemplate(data);
    if (error) { this.errorEl.setText(this.errorText(error)); return; }
    const previous = this.plugin.settings.customParamTemplates || [];
    const next = previous.filter((entry) => entry.key !== data.key);
    if (next.length >= 200) { this.errorEl.setText(this.errorText("At most 200 templates / 最多支持 200 个模板")); return; }
    this.plugin.settings.customParamTemplates = next.concat(data);
    try { await this.plugin.saveSettings(); } catch (error) { this.plugin.settings.customParamTemplates = previous; throw error; }
    this.onSaved(data.key);
    this.close();
  }

  errorText(error) {
    const parts = error.split(" / ");
    return loc(this.plugin) === "zh" ? (parts[1] || parts[0]) : parts[0];
  }

  onClose() { this.contentEl.empty(); }
}

export { PARAM_TEMPLATES, allParamTemplates, validateCustomParamTemplate, CustomParamTemplateModal, paramTemplateTokens, paramTemplateByKey, paramTemplateLabel, paramLabel, renderParamTemplate, getParamPresets, saveParamPreset, deleteParamPreset, paramValueError, renderLatexInto, ParamTemplateModal };
