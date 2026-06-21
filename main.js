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
  shortcuts: {
    fraction: "",
    sqrt: "",
    superscript: "",
    subscript: "",
    subSuper: "",
  },
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
    shortcuts: "Keyboard Shortcuts", shortcutsDesc: "Custom shortcuts for formula insertion (e.g. ctrl+f, ctrl+shift+f).",
    shortcutFraction: "Fraction (\\frac)", shortcutSqrt: "Square Root (\\sqrt)", shortcutSuper: "Superscript (^{})", shortcutSub: "Subscript (_{})", shortcutSubSuper: "Sub & Super (_{}^{})",
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
    shortcuts: "键盘快捷键", shortcutsDesc: "自定义公式插入快捷键（如 ctrl+f, ctrl+shift+f）。",
    shortcutFraction: "分数 (\\frac)", shortcutSqrt: "根号 (\\sqrt)", shortcutSuper: "上标 (^{})", shortcutSub: "下标 (_{})", shortcutSubSuper: "上下标 (_{}^{})",
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

const BUNDLED_FALLBACK = {"STRINGS":{"en":{"acceptInsert":"Insert","acceptUpdate":"Update","cancel":"Cancel","ready":"Ready","latexRequired":"Enter a LaTeX formula first.","rows":"Rows","columns":"Columns","tabs":{"greek":"Greek","structures":"Structures","delimiters":"Delimiters","analysis":"Analysis","algebra":"Algebra","geometry":"Geometry","topology":"Topology","numberTheory":"Number Theory","relations":"Relations","operators":"Operators","bigops":"Big Ops","arrows":"Arrows","sets":"Sets","functions":"Functions","probability":"Probability","chemistry":"Chemistry","physics":"Physics","misc":"Misc"}},"zh":{"acceptInsert":"插入","acceptUpdate":"更新","cancel":"取消","ready":"就绪","latexRequired":"请先输入 LaTeX 公式。","rows":"行数","columns":"列数","tabs":{"greek":"希腊","structures":"结构","delimiters":"分隔符","analysis":"分析","algebra":"代数","geometry":"几何","topology":"拓扑","numberTheory":"数论","relations":"关系","operators":"运算","bigops":"大型","arrows":"箭头","sets":"集合","functions":"函数","probability":"概率","chemistry":"化学","physics":"物理","misc":"其他"}}},"GROUPS":[{"id":"greek","structures":false,"items":[["α","\\alpha"],["β","\\beta"],["γ","\\gamma"],["δ","\\delta"],["ε","\\epsilon"],["θ","\\theta"],["λ","\\lambda"],["μ","\\mu"],["π","\\pi"],["σ","\\sigma"],["φ","\\phi"],["ω","\\omega"],["ρ","\\rho"],["τ","\\tau"],["κ","\\kappa"],["ν","\\nu"],["ξ","\\xi"],["η","\\eta"],["ζ","\\zeta"],["χ","\\chi"],["ψ","\\psi"],["ι","\\iota"],["υ","\\upsilon"],["ο","\\omicron"],["Γ","\\Gamma"],["Δ","\\Delta"],["Θ","\\Theta"],["Λ","\\Lambda"],["Ξ","\\Xi"],["Π","\\Pi"],["Σ","\\Sigma"],["Υ","\\Upsilon"],["Φ","\\Phi"],["Ψ","\\Psi"],["Ω","\\Omega"],["ϑ","\\vartheta"],["ϕ","\\varphi"],["ϵ","\\varepsilon"],["ϰ","\\varkappa"],["ϖ","\\varpi"],["ϱ","\\varrho"],["ς","\\varsigma"],["ϝ","\\digamma"],["ϴ","\\varTheta"],["∆","\\varDelta"],["Ϝ","Ϝ"],["Ϡ","\\Sampi"],["ϡ","\\sampi"],["϶","\\backepsilon"],["𝛤","\\varGamma"],["𝛬","\\varLambda"],["𝛱","\\varPi"]]},{"id":"structures","structures":true,"items":[["分数","\\frac{#?}{#?}","Fraction"],["上标","^{#?}","Superscript"],["下标","_{#?}","Subscript"],["上下标","_{#?}^{#?}","Subscript and superscript"],["上置","\\overset{#?}{#@}","Overset"],["下置","\\underset{#?}{#@}","Underset"],["向量","\\vec{#@}","Vector accent"],["短横线","\\overset{\\scriptscriptstyle -}{#@}","Bar accent"],["上横线","\\overline{#@}","Overline"],["下横线","\\underline{#@}","Underline"],["帽子","\\overset{\\wedge}{#@}","Hat accent"],["波浪线","\\overset{\\sim}{#@}","Tilde accent"],["单点","\\overset{\\cdot}{#@}","Dot accent"],["双点","\\overset{\\scriptscriptstyle \\bullet\\!\\bullet}{#@}","Double dot accent"],["抑扬符","\\overset{\\vee}{#@}","Check accent"],["圆圈重音","\\mathring{#@}","Ring accent"],["右向量线","\\overrightarrow{#@}","Over right arrow"],["左向量线","\\overleftarrow{#@}","Over left arrow"],["双向量线","\\overleftrightarrow{#@}","Over bidirectional arrow"],["下花括号","\\underbrace{#@}_{#?}","Underbrace"],["上花括号","\\overbrace{#@}^{#?}","Overbrace"],["方框","\\boxed{#@}","Boxed"],["划除","\\cancel{#@}","Cancel"],["删除线","\\enclose{horizontalstrike}{#@}","Strikethrough"],["根号","\\sqrt{#@}","Square root"],["n 次根","\\sqrt[#?]{#@}","Nth root"],["求和","\\sum_{#?}^{#?} #?","Summation"],["积分","\\int_{#?}^{#?} #?\\,d#?","Integral"],["极限","\\lim_{#? \\to #?} #?","Limit"],["乘积","\\prod_{#?}^{#?} #?","Product"],["二项式","\\binom{#?}{#?}","Binomial"],["对齐","\\begin{aligned} #? &= #? \\\\ #? &= #? \\end{aligned}","Aligned equations"],["分段","matrix:cases","Cases"],["矩阵","matrix:matrix","Matrix"],["方括号矩阵","matrix:bmatrix","Bracketed matrix"],["圆括号矩阵","matrix:pmatrix","Parenthesized matrix"],["花括号矩阵","matrix:Bmatrix","Braced matrix"],["雅可比矩阵","matrix:jacobian","Jacobian matrix"],["海森矩阵","matrix:hessian","Hessian matrix"],["单位矩阵","matrix:identity","Identity matrix"],["对角矩阵","matrix:diagonal","Diagonal matrix"],["增广矩阵","matrix:augmented","Augmented matrix"],["行列式","matrix:vmatrix","Determinant"]]},{"id":"delimiters","structures":false,"items":[["( )","\\left( #? \\right)","Parentheses"],["[ ]","\\left[ #? \\right]","Brackets"],["{ }","\\left\\{ #? \\right\\}","Braces"],["| |","\\left| #? \\right|","Absolute value"],["‖ ‖","\\left\\| #? \\right\\|","Norm"],["⟨ ⟩","\\left\\langle #? \\right\\rangle","Angle brackets"],["⎡ ⎤","\\left\\lceil #? \\right\\rceil","Ceiling"],["⎣ ⎦","\\left\\lfloor #? \\right\\rfloor","Floor"],["⟦ ⟧","\\left\\llbracket #? \\right\\rrbracket","Double brackets"],["( ]","\\left( #? \\right]","Half-open left"],["[ )","\\left[ #? \\right)","Half-open right"],["( ⋅","\\left( #? \\right.","Left parenthesis"],["⋅ )","\\left. #? \\right)","Right parenthesis"],["[ ⋅","\\left[ #? \\right.","Left bracket"],["⋅ ]","\\left. #? \\right]","Right bracket"],["{ ⋅","\\left\\{ #? \\right.","Left brace"],["⋅ }","\\left. #? \\right\\}","Right brace"],["⟨ ⋅","\\left\\langle #? \\right.","Left angle bracket"],["⋅ ⟩","\\left. #? \\right\\rangle","Right angle bracket"],["|ₓ","\\left. #? \\right|_{#?}","Evaluation at"],["⟨ψ|","\\left\\langle #? \\right|","Bra"],["|ψ⟩","\\left| #? \\right\\rangle","Ket"],["⟨ψ|φ⟩","\\left\\langle #? \\middle| #? \\right\\rangle","Bra-ket"],["⎛ ⎞","\\bigl(#?\\bigr)","Big parentheses"],["⎡ ⎤","\\bigl[#?\\bigr]","Big brackets"],["⦃ ⦄","\\bigl\\{#?\\bigr\\}","Big braces"],["⟪ ⟫","\\bigl\\langle#?\\bigr\\rangle","Big angle brackets"],["❘ ❘","\\bigl\\lvert#?\\bigr\\rvert","Big absolute"],["❙ ❙","\\bigl\\lVert#?\\bigr\\rVert","Big norm"],["⌜ ⌝","\\left\\ulcorner #? \\right\\urcorner","Top corners"],["⌞ ⌟","\\left\\llcorner #? \\right\\lrcorner","Bottom corners"],["/","/","Slash"],["\\","\\backslash","Backslash"],["⎛ ⎞","\\left\\lgroup #? \\right\\rgroup","Grouping parentheses"],["⎰","\\lmoustache","Left moustache"],["⎱","\\rmoustache","Right moustache"]]},{"id":"analysis","structures":true,"items":[{"section":"数学分析 / 实分析 - 概念 / 性质","sectionEn":"Mathematical / Real Analysis - Concepts / Properties"},["数列极限","\\lim_{n\\to\\infty}a_n=L","Sequence limit"],["函数极限","\\lim_{x\\to a}f(x)=L","Function limit"],["连续","f\\in C(X)","Continuity"],["一致连续","\\forall\\varepsilon>0\\;\\exists\\delta>0:\\;d(x,y)<\\delta\\Rightarrow |f(x)-f(y)|<\\varepsilon","Uniform continuity"],["可微函数","f\\in C^1(U)","Differentiable function"],["紧集","K\\subset X\\text{ compact}","Compact set"],["完备空间","(X,d)\\text{ complete}","Complete metric space"],["一致收敛","f_n\\rightrightarrows f","Uniform convergence"],["绝对连续","f\\in AC([a,b])","Absolute continuity"],["凸函数","f(tx+(1-t)y)\\le tf(x)+(1-t)f(y)","Convex function"],["导数","f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}","Derivative"],["高阶导数","f^{(n)}(x)","Higher derivative"],["偏导数","\\frac{\\partial f}{\\partial x_i}","Partial derivative"],["全微分","df=\\sum_i\\frac{\\partial f}{\\partial x_i}dx_i","Total differential"],["方向导数","D_{\\mathbf v}f=\\nabla f\\cdot\\mathbf v","Directional derivative"],["梯度","\\nabla f=\\left(\\frac{\\partial f}{\\partial x_1},\\ldots,\\frac{\\partial f}{\\partial x_n}\\right)","Gradient"],["散度","\\nabla\\cdot\\mathbf F=\\sum_i\\frac{\\partial F_i}{\\partial x_i}","Divergence"],["旋度","\\nabla\\times\\mathbf F","Curl"],["Jacobian","J_f=\\left(\\frac{\\partial f_i}{\\partial x_j}\\right)","Jacobian matrix"],["Hessian","H_f=\\left(\\frac{\\partial^2 f}{\\partial x_i\\partial x_j}\\right)","Hessian matrix"],["定积分","\\int_a^b f(x)\\,dx","Definite integral"],["不定积分","\\int f(x)\\,dx","Indefinite integral"],["重积分","\\int\\cdots\\int_D f\\,dV","Multiple integral"],["曲线积分","\\int_C f\\,ds","Line integral"],["曲面积分","\\int_S f\\,dS","Surface integral"],{"section":"数学分析 / 实分析 - 定理 / 公式","sectionEn":"Mathematical / Real Analysis - Theorems / Formulas"},["Heine-Borel","K\\subset\\mathbb{R}^n\\text{ compact}\\Longleftrightarrow K\\text{ closed and bounded}","Heine-Borel theorem"],["Bolzano-Weierstrass","(x_n)\\subset K\\text{ compact}\\implies\\exists x_{n_k}\\to x\\in K","Bolzano-Weierstrass theorem"],["介值定理","f([a,b])\\supset [f(a),f(b)]","Intermediate value theorem"],["Rolle 定理","f(a)=f(b)\\implies\\exists c:\\,f'(c)=0","Rolle theorem"],["Lagrange 中值","f(b)-f(a)=f'(\\xi)(b-a)","Mean value theorem"],["微分中值定理","\\exists\\xi\\in(a,b):\\;f(b)-f(a)=f'(\\xi)(b-a)","Differential mean value theorem"],["Cauchy 中值","\\frac{f(b)-f(a)}{g(b)-g(a)}=\\frac{f'(\\xi)}{g'(\\xi)}","Cauchy mean value theorem"],["Taylor 定理","f(x)=\\sum_{k=0}^{n}\\frac{f^{(k)}(a)}{k!}(x-a)^k+R_n(x)","Taylor theorem"],["Fermat 极值","f\\text{ has local extremum at }c\\implies f'(c)=0","Fermat theorem"],["Darboux 导数","f'\\text{ has the intermediate value property}","Darboux theorem for derivatives"],["闭区间有界","f\\in C([a,b])\\implies f\\text{ bounded}","Boundedness theorem"],["最值定理","f\\in C([a,b])\\implies\\exists x_m,x_M:\\,f(x_m)\\le f(x)\\le f(x_M)","Extreme value theorem"],["Cantor 一致连续","f\\in C(K),\\;K\\text{ compact}\\implies f\\text{ uniformly continuous}","Heine-Cantor theorem"],["Newton-Leibniz","\\int_a^b f'(x)\\,dx=f(b)-f(a)","Newton-Leibniz formula"],["第一积分中值","\\int_a^b f(x)g(x)\\,dx=f(\\xi)\\int_a^b g(x)\\,dx","First mean value theorem for integrals"],["第二积分中值","\\int_a^b f(x)g(x)\\,dx=f(a)\\int_a^\\xi g(x)\\,dx+f(b)\\int_\\xi^b g(x)\\,dx","Second mean value theorem for integrals"],["分部积分","\\int_a^b u\\,dv=uv\\big|_a^b-\\int_a^b v\\,du","Integration by parts"],["换元积分","\\int_{\\varphi(a)}^{\\varphi(b)}f(x)\\,dx=\\int_a^b f(\\varphi(t))\\varphi'(t)\\,dt","Change of variables"],["Green 定理","\\oint_{\\partial D}P\\,dx+Q\\,dy=\\iint_D\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dA","Green theorem"],["Gauss 散度","\\iiint_V\\nabla\\cdot\\mathbf F\\,dV=\\iint_{\\partial V}\\mathbf F\\cdot\\mathbf n\\,dS","Divergence theorem"],["Stokes 公式","\\oint_{\\partial S}\\mathbf F\\cdot d\\mathbf r=\\iint_S(\\nabla\\times\\mathbf F)\\cdot\\mathbf n\\,dS","Stokes theorem"],["Dini 定理","f_n\\uparrow f\\in C(K),\\;K\\text{ compact}\\implies f_n\\rightrightarrows f","Dini theorem"],["Arzela-Ascoli","\\mathcal{F}\\text{ equicontinuous and bounded}\\implies\\overline{\\mathcal{F}}\\text{ compact}","Arzela-Ascoli theorem"],["Weierstrass 逼近","\\overline{\\mathbb{R}[x]}^{\\|\\cdot\\|_\\infty}=C([a,b])","Weierstrass approximation"],["Stone-Weierstrass","A\\subset C(K)\\text{ separates points}\\implies\\overline{A}=C(K)","Stone-Weierstrass theorem"],["Banach 不动点","d(Tx,Ty)\\le qd(x,y),\\;q<1\\implies\\exists!x^*=Tx^*","Banach fixed point theorem"],{"section":"测度论 / 积分 - 概念 / 性质","sectionEn":"Measure / Integration - Concepts / Properties"},["σ-代数","\\mathcal{A}\\text{ is a }\\sigma\\text{-algebra}","Sigma algebra"],["测度空间","(X,\\mathcal{A},\\mu)","Measure space"],["可测函数","f:(X,\\mathcal{A})\\to(Y,\\mathcal{B})\\text{ measurable}","Measurable function"],["Lebesgue 积分","\\int_X f\\,d\\mu","Lebesgue integral"],["Lp 空间","L^p(X)=\\{f:\\int |f|^p d\\mu<\\infty\\}","Lp space"],["几乎处处","f=g\\quad\\mu\\text{-a.e.}","Almost everywhere"],{"section":"测度论 / 积分 - 定理 / 公式","sectionEn":"Measure / Integration - Theorems / Formulas"},["单调收敛","0\\le f_n\\uparrow f\\implies\\int f_n\\,d\\mu\\to\\int f\\,d\\mu","Monotone convergence theorem"],["控制收敛","|f_n|\\le g,\\;f_n\\to f\\implies\\int f_n\\to\\int f","Dominated convergence theorem"],["Fatou 引理","\\int\\liminf f_n\\,d\\mu\\le\\liminf\\int f_n\\,d\\mu","Fatou lemma"],["Fubini 定理","\\int_X\\int_Y f(x,y)\\,d\\nu\\,d\\mu=\\int_{X\\times Y}f\\,d(\\mu\\times\\nu)","Fubini theorem"],["Tonelli 定理","f\\ge0\\implies\\int_X\\int_Y f=\\int_{X\\times Y}f","Tonelli theorem"],["Radon-Nikodym","\\nu\\ll\\mu\\implies d\\nu=f\\,d\\mu","Radon-Nikodym theorem"],["Lebesgue 微分","\\lim_{r\\to0}\\frac1{|B_r|}\\int_{B_r(x)}f(y)dy=f(x)\\text{ a.e.}","Lebesgue differentiation theorem"],["Egorov 定理","f_n\\to f\\text{ a.e.}\\implies f_n\\rightrightarrows f\\text{ off small set}","Egorov theorem"],["Lusin 定理","f\\text{ measurable}\\implies f\\text{ continuous off small set}","Lusin theorem"],{"section":"复分析 / 多复变 - 概念 / 性质","sectionEn":"Complex / Several Complex Variables - Concepts / Properties"},["全纯函数","f\\in\\mathcal{O}(\\Omega)","Holomorphic function"],["亚纯函数","f\\in\\mathcal{M}(\\Omega)","Meromorphic function"],["留数","\\operatorname{Res}(f,a)=\\frac{1}{2\\pi i}\\oint_\\gamma f(z)\\,dz","Residue"],["Laurent 级数","f(z)=\\sum_{n=-\\infty}^{\\infty}a_n(z-a)^n","Laurent series"],["调和函数","\\Delta u=0","Harmonic function"],["共形映射","f:\\Omega\\to\\Omega'\\text{ conformal}","Conformal map"],["多复变量全纯","f\\in\\mathcal{O}(\\Omega\\subset\\mathbb{C}^n)","Several complex variables"],["Dolbeault 算子","\\bar\\partial f=0","Dolbeault operator"],{"section":"复分析 / 多复变 - 定理 / 公式","sectionEn":"Complex / Several Complex Variables - Theorems / Formulas"},["Cauchy 积分定理","\\oint_\\gamma f(z)\\,dz=0","Cauchy integral theorem"],["Cauchy 积分公式","f(a)=\\frac1{2\\pi i}\\oint_\\gamma\\frac{f(z)}{z-a}\\,dz","Cauchy integral formula"],["留数定理","\\oint_\\gamma f(z)dz=2\\pi i\\sum_k\\operatorname{Res}(f,a_k)","Residue theorem"],["辐角原理","\\frac1{2\\pi i}\\oint_\\gamma\\frac{f'}{f}dz=N-P","Argument principle"],["恒等定理","f|_A=g|_A,\\;A'\\cap\\Omega\\ne\\varnothing\\implies f=g","Identity theorem"],["最大模原理","|f|\\text{ has interior maximum}\\implies f\\text{ constant}","Maximum modulus principle"],["Schwarz 引理","|f(z)|\\le |z|,\\quad |f'(0)|\\le1","Schwarz lemma"],["Liouville 定理","f\\text{ entire bounded}\\implies f\\text{ constant}","Liouville theorem"],["Morera 定理","\\oint_\\gamma f(z)dz=0\\implies f\\text{ holomorphic}","Morera theorem"],["开映射定理","f\\in\\mathcal{O},\\;f\\text{ nonconstant}\\implies f\\text{ open}","Open mapping theorem"],["Rouche 定理","|g|<|f|\\text{ on }\\partial D\\implies f,g+f\\text{ same zeros}","Rouche theorem"],["Riemann 映射","\\Omega\\subsetneq\\mathbb{C}\\text{ simply connected}\\implies\\Omega\\cong\\mathbb{D}","Riemann mapping theorem"],["Montel 定理","\\mathcal{F}\\text{ locally bounded}\\implies\\mathcal{F}\\text{ normal}","Montel theorem"],["Mittag-Leffler","\\exists f\\in\\mathcal{M}(\\Omega)\\text{ with prescribed principal parts}","Mittag-Leffler theorem"],["Weierstrass 分解","f(z)=z^m e^{g(z)}\\prod_n E_{p_n}(z/a_n)","Weierstrass factorization"],["Hartogs 延拓","n\\ge2\\implies\\text{compact holes are removable}","Hartogs extension theorem"],["Runge 定理","K\\Subset\\Omega,\\;\\mathbb{C}\\setminus K\\text{ no bounded component}\\implies f\\approx r","Runge theorem"],["Mergelyan 定理","f\\in A(K)\\implies f\\text{ uniformly approximable by polynomials}","Mergelyan theorem"],["Picard 小定理","f\\text{ entire nonconstant}\\implies\\mathbb{C}\\setminus f(\\mathbb{C})\\text{ has at most one point}","Little Picard theorem"],["Phragmen-Lindelof","|f|\\text{ bounded on boundary and growth controlled}\\implies |f|\\text{ bounded}","Phragmen-Lindelof principle"],["Levi 问题","\\Omega\\text{ pseudoconvex}\\Longleftrightarrow\\Omega\\text{ domain of holomorphy}","Levi problem"],["Oka-Cartan","H^q(X,\\mathcal{F})=0\\quad(q>0)","Oka-Cartan theorem"],{"section":"泛函分析 / 算子理论 - 概念 / 性质","sectionEn":"Functional Analysis / Operator Theory - Concepts / Properties"},["赋范空间","(X,\\|\\cdot\\|)","Normed space"],["Banach 空间","(X,\\|\\cdot\\|)\\text{ complete}","Banach space"],["Hilbert 空间","(\\mathcal{H},\\langle\\cdot,\\cdot\\rangle)\\text{ complete}","Hilbert space"],["有界算子","T\\in\\mathcal{B}(X,Y)","Bounded operator"],["紧算子","T\\in\\mathcal{K}(X,Y)","Compact operator"],["对偶空间","X^*","Dual space"],["弱收敛","x_n\\rightharpoonup x","Weak convergence"],["谱","\\sigma(T)=\\{\\lambda:T-\\lambda I\\text{ not invertible}\\}","Spectrum"],["Fredholm 算子","\\operatorname{ind}T=\\dim\\ker T-\\dim\\operatorname{coker}T","Fredholm operator"],{"section":"泛函分析 / 算子理论 - 定理 / 公式","sectionEn":"Functional Analysis / Operator Theory - Theorems / Formulas"},["Hahn-Banach","p(x)\\ge f(x)\\implies\\exists F\\supset f,\\;F(x)\\le p(x)","Hahn-Banach theorem"],["一致有界原理","\\sup_n\\|T_nx\\|<\\infty\\;\\forall x\\implies\\sup_n\\|T_n\\|<\\infty","Uniform boundedness principle"],["开映射定理","T:X\\to Y\\text{ surjective bounded linear}\\implies T\\text{ open}","Open mapping theorem"],["闭图像定理","\\operatorname{graph}(T)\\text{ closed}\\implies T\\text{ bounded}","Closed graph theorem"],["Banach-Alaoglu","B_{X^*}\\text{ is weak-* compact}","Banach-Alaoglu theorem"],["Riesz 表示","\\mathcal{H}^*\\cong\\mathcal{H}","Riesz representation theorem"],["谱半径公式","r(T)=\\lim_{n\\to\\infty}\\|T^n\\|^{1/n}","Spectral radius formula"],["谱定理","T=T^*\\implies T=\\int_{\\sigma(T)}\\lambda\\,dE(\\lambda)","Spectral theorem"],["Fredholm 二择一","T\\text{ compact}\\implies I-T\\text{ invertible or }\\ker(I-T)\\ne0","Fredholm alternative"],["Krein-Milman","K=\\overline{\\operatorname{conv}}\\operatorname{Ext}(K)","Krein-Milman theorem"],["Eberlein-Smulyan","K\\subset X\\text{ weakly compact}\\Longleftrightarrow K\\text{ weakly sequentially compact}","Eberlein-Smulyan theorem"],["Lumer-Phillips","A\\text{ maximal dissipative}\\Longleftrightarrow A\\text{ generates contraction semigroup}","Lumer-Phillips theorem"],["Hille-Yosida","A\\text{ generates }C_0\\text{-semigroup}\\Longleftrightarrow\\|R(\\lambda,A)^n\\|\\le\\frac{M}{(\\lambda-\\omega)^n}","Hille-Yosida theorem"],["Schauder 不动点","T:K\\to K\\text{ continuous compact}\\implies\\exists x=Tx","Schauder fixed point theorem"],{"section":"调和分析 / Fourier 分析 - 概念 / 性质","sectionEn":"Harmonic / Fourier Analysis - Concepts / Properties"},["Fourier 变换","\\widehat f(\\xi)=\\int_{\\mathbb{R}^n}f(x)e^{-2\\pi ix\\cdot\\xi}dx","Fourier transform"],["逆 Fourier","f(x)=\\int_{\\mathbb{R}^n}\\widehat f(\\xi)e^{2\\pi ix\\cdot\\xi}d\\xi","Inverse Fourier transform"],["卷积","(f*g)(x)=\\int f(y)g(x-y)dy","Convolution"],["Schwartz 空间","\\mathcal{S}(\\mathbb{R}^n)","Schwartz space"],["缓增分布","\\mathcal{S}'(\\mathbb{R}^n)","Tempered distributions"],["Hardy-Littlewood 最大","Mf(x)=\\sup_{r>0}\\frac1{|B_r|}\\int_{B_r(x)}|f(y)|dy","Hardy-Littlewood maximal function"],["Hilbert 变换","\\mathcal{H}f(x)=\\frac1\\pi\\operatorname{p.v.}\\int\\frac{f(y)}{x-y}dy","Hilbert transform"],["Riesz 变换","R_j f=\\mathcal{F}^{-1}\\!\\left(-i\\frac{\\xi_j}{|\\xi|}\\widehat f\\right)","Riesz transform"],["Littlewood-Paley","f=\\sum_j\\Delta_j f","Littlewood-Paley decomposition"],["BMO","\\|f\\|_{\\mathrm{BMO}}=\\sup_Q\\frac1{|Q|}\\int_Q|f-f_Q|","BMO"],["Hardy 空间","H^p=\\{f:\\sup_{0<r<1}\\|f(re^{i\\theta})\\|_{L^p}<\\infty\\}","Hardy space"],["Carleson 测度","\\mu(S_I)\\le C|I|","Carleson measure"],["Fourier 限制","\\mathcal R_Sf=\\widehat f\\big|_S","Fourier restriction"],["Besov 空间","\\|f\\|_{B^s_{p,q}}=\\left(\\sum_j 2^{jsq}\\|\\Delta_jf\\|_p^q\\right)^{1/q}","Besov space"],["Triebel-Lizorkin","\\|f\\|_{F^s_{p,q}}=\\left\\|\\left(\\sum_j 2^{jsq}|\\Delta_jf|^q\\right)^{1/q}\\right\\|_p","Triebel-Lizorkin space"],{"section":"调和分析 / Fourier 分析 - 定理 / 公式","sectionEn":"Harmonic / Fourier Analysis - Theorems / Formulas"},["Parseval 恒等式","\\sum_n |c_n|^2=\\frac1{2\\pi}\\int_{-\\pi}^{\\pi}|f(x)|^2dx","Parseval identity"],["Plancherel 定理","\\|\\widehat f\\|_{L^2}=\\|f\\|_{L^2}","Plancherel theorem"],["卷积定理","\\widehat{f*g}=\\widehat f\\,\\widehat g","Convolution theorem"],["Hausdorff-Young","\\|\\widehat f\\|_{p'}\\le\\|f\\|_p\\quad(1\\le p\\le2)","Hausdorff-Young inequality"],["Riesz-Thorin 插值","\\|T\\|_{L^{p_\\theta}\\to L^{q_\\theta}}\\le M_0^{1-\\theta}M_1^\\theta","Riesz-Thorin interpolation"],["Marcinkiewicz 插值","T:L^{p_i}\\to L^{p_i,\\infty}\\implies T:L^p\\to L^p","Marcinkiewicz interpolation"],["Hardy-Littlewood 最大定理","\\|Mf\\|_{L^p}\\le C_p\\|f\\|_{L^p}\\quad(p>1)","Hardy-Littlewood maximal theorem"],["Calderon-Zygmund","T:L^p\\to L^p\\quad(1<p<\\infty)","Calderon-Zygmund theorem"],["Mikhlin 乘子","|\\partial^\\alpha m(\\xi)|\\le C_\\alpha|\\xi|^{-|\\alpha|}\\implies T_m:L^p\\to L^p","Mikhlin multiplier theorem"],["Carleson 定理","S_N f(x)\\to f(x)\\text{ a.e. for }f\\in L^2(\\mathbb{T})","Carleson theorem"],["T(1) 定理","T\\text{ Calderon-Zygmund bounded}\\Longleftrightarrow T1,T^*1\\in\\mathrm{BMO}","T(1) theorem"],["T(b) 定理","T\\text{ bounded under accretive testing functions }b","T(b) theorem"],["Coifman-Meyer","\\|T_m(f,g)\\|_p\\le C\\|f\\|_{p_1}\\|g\\|_{p_2}","Coifman-Meyer theorem"],["Restriction 猜想","\\|\\widehat f\\|_{L^q(S)}\\le C\\|f\\|_{L^p(\\mathbb{R}^n)}","Restriction conjecture"],{"section":"PDE / 变分法 / 微局部 - 概念 / 性质","sectionEn":"PDE / Calculus of Variations / Microlocal - Concepts / Properties"},["弱导数","\\int u\\,D^\\alpha\\varphi=(-1)^{|\\alpha|}\\int D^\\alpha u\\,\\varphi","Weak derivative"],["Sobolev 空间","W^{k,p}(\\Omega)=\\{u:D^\\alpha u\\in L^p,\\;|\\alpha|\\le k\\}","Sobolev space"],["弱解","a(u,v)=\\langle f,v\\rangle\\quad\\forall v\\in V","Weak solution"],["基本解","L\\Phi=\\delta","Fundamental solution"],["Green 函数","LG(x,y)=\\delta_y","Green function"],["椭圆算子","\\sum_{i,j}a^{ij}(x)\\xi_i\\xi_j\\ge\\lambda|\\xi|^2","Elliptic operator"],["抛物方程","\\partial_t u-Lu=f","Parabolic equation"],["双曲方程","\\partial_t^2u-Lu=f","Hyperbolic equation"],["波前集","\\operatorname{WF}(u)","Wavefront set"],["Navier-Stokes 弱解","u\\in L^2_tH^1_x,\\quad \\partial_tu+(u\\cdot\\nabla)u+\\nabla p=\\nu\\Delta u","Navier-Stokes weak solution"],["Strichartz 范数","\\|u\\|_{L^q_tL^r_x}","Strichartz norm"],["黏性解","F(x,u,Du,D^2u)=0\\text{ in viscosity sense}","Viscosity solution"],{"section":"PDE / 变分法 / 微局部 - 定理 / 公式","sectionEn":"PDE / Calculus of Variations / Microlocal - Theorems / Formulas"},["Lax-Milgram","a(u,v)=\\langle f,v\\rangle\\quad\\forall v\\in V","Lax-Milgram theorem"],["Sobolev 嵌入","W^{k,p}(\\Omega)\\hookrightarrow L^q(\\Omega)","Sobolev embedding theorem"],["Poincare 不等式","\\|u-u_\\Omega\\|_{L^p}\\le C\\|\\nabla u\\|_{L^p}","Poincare inequality"],["Morrey 不等式","W^{1,p}(\\Omega)\\hookrightarrow C^{0,1-n/p}(\\Omega)\\quad(p>n)","Morrey inequality"],["Rellich-Kondrachov","W^{1,p}(\\Omega)\\Subset L^q(\\Omega)","Rellich-Kondrachov theorem"],["最大值原理","Lu\\ge0\\implies\\max_\\Omega u\\le\\max_{\\partial\\Omega}u","Maximum principle"],["Hopf 引理","\\partial_\\nu u(x_0)<0","Hopf boundary point lemma"],["Schauder 估计","\\|u\\|_{C^{2,\\alpha}}\\le C(\\|Lu\\|_{C^\\alpha}+\\|u\\|_{C^0})","Schauder estimate"],["Calderon-Zygmund 估计","\\|D^2u\\|_{L^p}\\le C\\|Lu\\|_{L^p}","Calderon-Zygmund estimate"],["De Giorgi-Nash-Moser","u\\text{ weak solution}\\implies u\\in C^\\alpha_{\\mathrm{loc}}","De Giorgi-Nash-Moser theorem"],["Cauchy-Kowalevski","\\text{analytic data}\\implies\\exists!\\text{ analytic solution}","Cauchy-Kowalevski theorem"],["Euler-Lagrange","\\frac{\\partial L}{\\partial u}-\\partial_i\\frac{\\partial L}{\\partial u_i}=0","Euler-Lagrange equation"],["Noether 定理","\\text{symmetry}\\implies\\partial_\\mu j^\\mu=0","Noether theorem"],["伪微分算子","Pu(x)=\\int e^{ix\\cdot\\xi}p(x,\\xi)\\widehat u(\\xi)d\\xi","Pseudodifferential operator"],["弱 Harnack","\\left(\\fint_{B_R}u^p\\right)^{1/p}\\le C\\inf_{B_R}u","Weak Harnack inequality"],["Strichartz 估计","\\|e^{it\\Delta}f\\|_{L^q_tL^r_x}\\le C\\|f\\|_{L^2}","Strichartz estimate"],["能量估计","\\|u\\|_{H^1}\\le C\\|f\\|_{H^{-1}}","Energy estimate"],["先验估计","\\|u\\|_X\\le C\\|f\\|_Y","A priori estimate"],["Garding 不等式","\\operatorname{Re}\\langle Lu,u\\rangle\\ge c\\|u\\|_{H^1}^2-\\lambda\\|u\\|_{L^2}^2","Garding inequality"],["梯度估计","\\sup_{B_{R/2}}|\\nabla u|\\le \\frac{C}{R}\\sup_{B_R}|u|","Gradient estimate"],["Carleman 估计","\\int|e^{\\tau\\varphi}u|^2\\le C\\int|e^{\\tau\\varphi}Pu|^2\\quad(\\tau\\gg1)","Carleman estimate"],["椭圆正则性","Lu=f\\in H^s\\implies u\\in H^{s+2}_{\\mathrm{loc}}","Elliptic regularity"],["Leray-Hopf","u\\text{ solves Navier-Stokes and satisfies energy inequality}","Leray-Hopf weak solution"],{"section":"ODE / 动力系统 / 凸优化 - 概念 / 性质","sectionEn":"ODE / Dynamical Systems / Convex Optimization - Concepts / Properties"},["初值问题","\\dot x=f(t,x),\\quad x(t_0)=x_0","Initial value problem"],["流映射","\\varphi_t:X\\to X","Flow map"],["Lyapunov 函数","V(x)>0,\\quad \\dot V(x)\\le0","Lyapunov function"],["Hamilton 系统","\\dot q=\\partial_pH,\\quad\\dot p=-\\partial_qH","Hamiltonian system"],["凸共轭","f^*(y)=\\sup_x(\\langle x,y\\rangle-f(x))","Fenchel conjugate"],{"section":"ODE / 动力系统 / 凸优化 - 定理 / 公式","sectionEn":"ODE / Dynamical Systems / Convex Optimization - Theorems / Formulas"},["Picard-Lindelof","f\\text{ locally Lipschitz}\\implies\\exists!x(t)","Picard-Lindelof theorem"],["Gronwall 不等式","u(t)\\le a+\\int_0^t b(s)u(s)ds\\implies u(t)\\le a e^{\\int_0^t b}","Gronwall inequality"],["Sobolev 不等式","\\|u\\|_{L^q(\\mathbb R^n)}\\le C\\|\\nabla u\\|_{L^p(\\mathbb R^n)}","Sobolev inequality"],["等周不等式","\\operatorname{Area}(\\partial\\Omega)\\ge n\\operatorname{Vol}(\\Omega)^{1-1/n}\\operatorname{Vol}(B_1)^{1/n}","Isoperimetric inequality"],["Hölder 不等式","\\int_\\Omega|fg|dx\\le\\left(\\int_\\Omega|f|^p\\right)^{1/p}\\left(\\int_\\Omega|g|^q\\right)^{1/q}","Holder inequality"],["Minkowski 不等式","\\left(\\int|f+g|^p\\right)^{1/p}\\le\\left(\\int|f|^p\\right)^{1/p}+\\left(\\int|g|^p\\right)^{1/p}","Minkowski inequality"],["Young 不等式","ab\\le\\frac{a^p}{p}+\\frac{b^q}{q}","Young inequality"],["Jensen 不等式","\\varphi\\!\\left(\\int f\\right)\\le\\int\\varphi(f)","Jensen inequality"],["Wirtinger 不等式","\\int_0^{2\\pi}|f-\\bar f|^2\\le\\int_0^{2\\pi}|f'|^2","Wirtinger inequality"],["Hardy 不等式","\\int_0^\\infty\\!\\left|\\frac1x\\int_0^x f\\right|^p\\!dx\\le\\left(\\frac{p}{p-1}\\right)^p\\!\\int_0^\\infty|f|^p","Hardy inequality"],["Gagliardo-Nirenberg","\\|D^j u\\|_{L^r}\\le C\\|D^m u\\|_{L^p}^{\\frac{j}{m}}\\|u\\|_{L^q}^{1-\\frac{j}{m}}","Gagliardo-Nirenberg inequality"],["Trudinger 不等式","\\int_\\Omega\\exp\\!\\left(\\alpha|u|^{\\frac{n}{n-1}}\\right)<\\infty","Trudinger inequality"],["Cheeger 不等式","\\lambda_1\\ge\\frac{h^2}{4},\\; h=\\inf\\frac{|\\partial A|}{|A|}","Cheeger inequality"],["Caccioppoli 不等式","\\int|\\nabla u|^2\\le C\\int|u|^2","Caccioppoli inequality"],["Korn 不等式","\\|\\nabla u\\|_{L^2}\\le C\\|\\varepsilon(u)\\|_{L^2}","Korn inequality"],["Brunn-Minkowski","|A+B|^{1/n}\\ge|A|^{1/n}+|B|^{1/n}","Brunn-Minkowski inequality"],["Harnack 不等式","\\sup_{B_{r/2}}u\\le C\\inf_{B_{r/2}}u","Harnack inequality"],["Poincare-Bendixson","\\omega(x)\\text{ compact planar limit set}\\implies\\text{ equilibrium or periodic orbit}","Poincare-Bendixson theorem"],["Stable manifold","W^s(p)=\\{x:\\varphi_t(x)\\to p\\}","Stable manifold theorem"],["KKT 条件","\\nabla f(x)+\\sum_i\\lambda_i\\nabla g_i(x)=0","KKT conditions"],["Fenchel-Rockafellar","\\inf_x f(x)+g(Ax)=\\sup_y -f^*(-A^*y)-g^*(y)","Fenchel-Rockafellar duality"],["Pontryagin 最大值","\\dot x=\\partial_pH,\\quad \\dot p=-\\partial_xH,\\quad H=\\max_u H(x,p,u)","Pontryagin maximum principle"]]},{"id":"algebra","structures":true,"items":[{"section":"线性代数 / 矩阵论 - 概念 / 性质","sectionEn":"Linear Algebra / Matrix Theory - Concepts / Properties"},["向量空间","V\\text{ over }\\mathbb{F}","Vector space"],["子空间","W\\le V","Subspace"],["线性组合","\\sum_i a_i v_i","Linear combination"],["张成","\\operatorname{span}\\{v_1,ldots,v_k\\}","Span"],["线性无关","\\sum_i a_i v_i=0\\implies a_i=0","Linear independence"],["基","\\mathcal B=(v_1,ldots,v_n)","Basis"],["维数","\\dim V=n","Dimension"],["线性映射","T:V\\to W","Linear map"],["核","\\ker T","Kernel"],["像","\\operatorname{im}T","Image"],["商空间","V/W","Quotient vector space"],["对偶基","e^i(e_j)=\\delta^i_j","Dual basis"],["坐标向量","[v]_{\\mathcal B}","Coordinate vector"],["矩阵乘法","(AB)_{ij}=\\sum_k A_{ik}B_{kj}","Matrix multiplication"],["逆矩阵","AA^{-1}=I","Inverse matrix"],["迹","\\operatorname{tr}A","Trace"],["行列式","\\det A","Determinant"],["秩","\\operatorname{rank}A","Rank"],["特征值","Av=\\lambda v","Eigenvalue"],["特征多项式","p_A(\\lambda)=\\det(\\lambda I-A)","Characteristic polynomial"],["Jordan 块","J_k(\\lambda)","Jordan block"],["内积","\\langle x,y\\rangle","Inner product"],["正交补","W^\\perp","Orthogonal complement"],["正交投影","\\operatorname{proj}_W(v)","Orthogonal projection"],["张量积","V\\otimes W","Tensor product"],{"section":"线性代数 / 矩阵论 - 定理 / 公式","sectionEn":"Linear Algebra / Matrix Theory - Theorems / Formulas"},["秩-零化度","\\dim V=\\operatorname{rank}T+\\operatorname{nullity}T","Rank-nullity theorem"],["Cayley-Hamilton","p_A(A)=0","Cayley-Hamilton theorem"],["谱定理","A=A^*\\implies A=U\\Lambda U^*","Spectral theorem"],["Jordan 标准形","A\\sim\\operatorname{diag}(J_1,\\ldots,J_k)","Jordan normal form"],["SVD","A=U\\Sigma V^*","Singular value decomposition"],["Schur 分解","A=QTQ^*","Schur decomposition"],["Sylvester 惯性","Q\\sim I_p\\oplus(-I_q)\\oplus0_r","Sylvester law of inertia"],["Cramer 法则","x_i=\\frac{\\det A_i}{\\det A}","Cramer rule"],["Steinitz 交换","\\text{independent set can be extended to a basis}","Steinitz exchange lemma"],["基扩张定理","S\\text{ linearly independent}\\implies S\\subset\\mathcal B","Basis extension theorem"],["Gram-Schmidt","u_k=v_k-\\sum_{j<k}\\operatorname{proj}_{u_j}v_k","Gram-Schmidt process"],["正交分解","V=W\\oplus W^\\perp","Orthogonal decomposition"],["最小多项式","m_A(A)=0,\\quad m_A\\mid p_A","Minimal polynomial theorem"],{"section":"群论 / 伽罗瓦理论 - 概念 / 性质","sectionEn":"Group Theory / Galois Theory - Concepts / Properties"},["群","(G,\\cdot)","Group"],["子群","H\\le G","Subgroup"],["正规子群","N\\triangleleft G","Normal subgroup"],["商群","G/N","Quotient group"],["群同态","\\varphi:G\\to H","Group homomorphism"],["群同构","G\\cong H","Group isomorphism"],["自同构群","\\operatorname{Aut}(G)","Automorphism group"],["循环群","C_n=\\langle g\\rangle","Cyclic group"],["置换群","S_n","Symmetric group"],["陪集","gH","Coset"],["群作用","G\\curvearrowright X","Group action"],["轨道","Gx","Orbit"],["稳定子","G_x","Stabilizer"],["可解群","G^{(n)}=1","Solvable group"],["伽罗瓦群","\\operatorname{Gal}(L/K)","Galois group"],["域扩张","L/K","Field extension"],["环同态","f:R\\to S","Ring homomorphism"],["理想运算","I+J,\\quad IJ,\\quad I\\cap J","Ideal operations"],["域","\\mathbb F","Field"],["多项式环","R[x_1,ldots,x_n]","Polynomial ring"],["PID","R\\text{ principal ideal domain}","Principal ideal domain"],["UFD","R\\text{ unique factorization domain}","Unique factorization domain"],{"section":"群论 / 伽罗瓦理论 - 定理 / 公式","sectionEn":"Group Theory / Galois Theory - Theorems / Formulas"},["Lagrange 定理","|G|=|H|[G:H]","Lagrange theorem"],["第一同构定理","G/\\ker\\varphi\\cong\\operatorname{im}\\varphi","First isomorphism theorem"],["第二同构定理","H/(H\\cap N)\\cong HN/N","Second isomorphism theorem"],["第三同构定理","(G/N)/(H/N)\\cong G/H","Third isomorphism theorem"],["轨道-稳定子","|Gx|=[G:G_x]","Orbit-stabilizer theorem"],["Burnside 引理","|X/G|=\\frac1{|G|}\\sum_{g\\in G}|X^g|","Burnside lemma"],["Cauchy 群定理","p\\mid |G|\\implies\\exists g:\\,|g|=p","Cauchy group theorem"],["Sylow 定理","n_p\\equiv1\\pmod p,\\quad n_p\\mid |G|/p^k","Sylow theorems"],["Jordan-Holder","\\text{composition factors are unique up to order}","Jordan-Holder theorem"],["Galois 基本定理","\\{E:K\\subset E\\subset L\\}\\leftrightarrow\\{H\\le\\operatorname{Gal}(L/K)\\}","Fundamental theorem of Galois theory"],["Abel-Ruffini","n\\ge5\\implies\\text{generic polynomial not solvable by radicals}","Abel-Ruffini theorem"],{"section":"环论 / 模论 / 交换代数 - 概念 / 性质","sectionEn":"Ring / Module / Commutative Algebra - Concepts / Properties"},["环","(R,+,\\cdot)","Ring"],["理想","I\\triangleleft R","Ideal"],["商环","R/I","Quotient ring"],["模","M\\text{ is an }R\\text{-module}","Module"],["局部化","S^{-1}R","Localization"],["Noether 环","R\\text{ Noetherian}","Noetherian ring"],["Artin 环","R\\text{ Artinian}","Artinian ring"],["整闭","R\\text{ integrally closed}","Integrally closed"],["平坦模","M\\text{ flat}","Flat module"],["正则局部环","\\dim R=\\dim_{k}\\mathfrak{m}/\\mathfrak{m}^2","Regular local ring"],["正则列","x_1,\\ldots,x_r\\text{ is }M\\text{-regular}","Regular sequence"],["深度","\\operatorname{depth}_RM","Depth"],["Cohen-Macaulay","\\operatorname{depth}R=\\dim R","Cohen-Macaulay ring"],["局部上同调","H_I^i(M)","Local cohomology"],{"section":"环论 / 模论 / 交换代数 - 定理 / 公式","sectionEn":"Ring / Module / Commutative Algebra - Theorems / Formulas"},["中国剩余定理","R/(I_1\\cap\\cdots\\cap I_n)\\cong\\prod_i R/I_i","Chinese remainder theorem"],["Hilbert 基定理","R\\text{ Noetherian}\\implies R[x]\\text{ Noetherian}","Hilbert basis theorem"],["Nakayama 引理","M=\\mathfrak mM\\implies M=0","Nakayama lemma"],["Krull 主理想定理","\\operatorname{ht}(\\mathfrak p)\\le n\\text{ over }(f_1,\\ldots,f_n)","Krull principal ideal theorem"],["主分解","I=Q_1\\cap\\cdots\\cap Q_r","Primary decomposition"],["Krull 交定理","\\bigcap_{n\\ge0}I^nM=0","Krull intersection theorem"],["Auslander-Buchsbaum","\\operatorname{pd}_RM+\\operatorname{depth}M=\\operatorname{depth}R","Auslander-Buchsbaum formula"],["Hilbert 零维定理","R\\text{ Artinian}\\Longleftrightarrow\\dim R=0\\text{ and }R\\text{ Noetherian}","Artinian dimension theorem"],["Krull 维数定理","\\dim R=\\sup\\{n:\\mathfrak p_0\\subsetneq\\cdots\\subsetneq\\mathfrak p_n\\}","Krull dimension theorem"],{"section":"同调代数 / 范畴论 - 概念 / 性质","sectionEn":"Homological Algebra / Category Theory - Concepts / Properties"},["范畴","\\mathcal C=(\\operatorname{Ob}\\mathcal C,\\operatorname{Hom}_{\\mathcal C})","Category"],["函子","F:\\mathcal{C}\\to\\mathcal{D}","Functor"],["自然变换","\\eta:F\\Rightarrow G","Natural transformation"],["伴随函子","F\\dashv G","Adjoint functor"],["极限","\\varprojlim F","Limit"],["余极限","\\varinjlim F","Colimit"],["链复形","\\cdots\\to C_{n+1}\\xrightarrow{\\partial}C_n\\xrightarrow{\\partial}C_{n-1}\\to\\cdots","Chain complex"],["导出范畴","D(\\mathcal{A})","Derived category"],["Tor","\\operatorname{Tor}^R_n(M,N)","Tor functor"],["Ext","\\operatorname{Ext}^n_R(M,N)","Ext functor"],["三角范畴","(\\mathcal{T},[1],\\Delta)","Triangulated category"],["模型范畴","(\\mathcal C,\\mathcal W,\\mathcal COf,\\mathcal Fib)","Model category"],["∞-范畴","\\infty\\text{-category}","Infinity category"],{"section":"同调代数 / 范畴论 - 定理 / 公式","sectionEn":"Homological Algebra / Category Theory - Theorems / Formulas"},["蛇形引理","\\ker f\\to\\ker g\\to\\ker h\\xrightarrow{\\delta}\\operatorname{coker}f\\to\\operatorname{coker}g\\to\\operatorname{coker}h","Snake lemma"],["五引理","\\text{exact diagram}\\implies f_3\\text{ isomorphism}","Five lemma"],["九引理","\\text{two exact rows/columns}\\implies\\text{ third exact}","Nine lemma"],["长正合列","\\cdots\\to H_n(A)\\to H_n(B)\\to H_n(C)\\xrightarrow{\\delta}H_{n-1}(A)\\to\\cdots","Long exact sequence"],["Yoneda 引理","\\operatorname{Nat}(\\operatorname{Hom}(A,-),F)\\cong F(A)","Yoneda lemma"],["Freyd 伴随函子","F\\text{ preserves limits and solution set}\\implies F\\text{ has left adjoint}","Adjoint functor theorem"],["Grothendieck 谱序列","E_2^{p,q}=R^pG(R^qF(A))\\Rightarrow R^{p+q}(GF)(A)","Grothendieck spectral sequence"],["Brown 表示","H:\\mathcal T^{op}\\to\\mathbf{Set}\\text{ cohomological}\\implies H\\cong\\operatorname{Hom}(-,X)","Brown representability"],["Dold-Kan","s\\mathbf{Ab}\\simeq Ch_{\\ge0}(\\mathbf{Ab})","Dold-Kan correspondence"],{"section":"表示论 / 李理论 - 概念 / 性质","sectionEn":"Representation Theory / Lie Theory - Concepts / Properties"},["表示","\\rho:G\\to GL(V)","Representation"],["特征标","\\chi_\\rho(g)=\\operatorname{tr}\\rho(g)","Character"],["李群","G\\text{ Lie group}","Lie group"],["李代数","\\mathfrak g=T_eG","Lie algebra"],["李括号","[X,Y]","Lie bracket"],["根系","\\Phi\\subset\\mathfrak h^*","Root system"],["Weyl 群","W=\\langle s_\\alpha:\\alpha\\in\\Phi\\rangle","Weyl group"],["最高权","V(\\lambda)","Highest weight"],["包络代数","U(\\mathfrak g)","Universal enveloping algebra"],["Verma 模","M(\\lambda)","Verma module"],["BGG 范畴 O","\\mathcal O","BGG category O"],{"section":"表示论 / 李理论 - 定理 / 公式","sectionEn":"Representation Theory / Lie Theory - Theorems / Formulas"},["Schur 引理","\\operatorname{Hom}_G(V,W)\\cong\\mathbb{C}","Schur lemma"],["Maschke 定理","\\operatorname{char}K\\nmid |G|\\implies KG\\text{ semisimple}","Maschke theorem"],["Peter-Weyl","L^2(G)=\\widehat\\bigoplus_{\\pi\\in\\widehat G}V_\\pi\\otimes V_\\pi^*","Peter-Weyl theorem"],["Weyl 特征公式","\\chi_\\lambda=\\frac{\\sum_{w\\in W}\\operatorname{sgn}(w)e^{w(\\lambda+\\rho)}}{\\sum_{w\\in W}\\operatorname{sgn}(w)e^{w\\rho}}","Weyl character formula"],["Engel 定理","\\operatorname{ad}x\\text{ nilpotent}\\;\\forall x\\implies\\mathfrak g\\text{ nilpotent}","Engel theorem"],["Lie 定理","\\mathfrak g\\text{ solvable}\\implies\\text{ simultaneous upper triangular}","Lie theorem"],["Cartan 判别","\\mathfrak g\\text{ semisimple}\\Longleftrightarrow B\\text{ nondegenerate}","Cartan criterion"],["PBW 定理","\\operatorname{gr}U(\\mathfrak g)\\cong\\operatorname{Sym}(\\mathfrak g)","PBW theorem"],["Weyl 完全可约","\\mathfrak g\\text{ semisimple}\\implies V\\text{ completely reducible}","Weyl complete reducibility"],["BGG 分解","0\\to M(w_0\\cdot\\lambda)\\to\\cdots\\to M(\\lambda)\\to L(\\lambda)\\to0","BGG resolution"],["Kazhdan-Lusztig","[M(y\\cdot\\lambda):L(w\\cdot\\lambda)]=P_{w,y}(1)","Kazhdan-Lusztig theorem"],{"section":"代数几何 / 非交换代数 - 概念 / 性质","sectionEn":"Algebraic Geometry / Noncommutative Algebra - Concepts / Properties"},["仿射簇","V(I)\\subset\\mathbb A^n","Affine variety"],["射影簇","V_+(I)\\subset\\mathbb P^n","Projective variety"],["概形","(X,\\mathcal O_X)","Scheme"],["层","\\mathcal F:\\operatorname{Open}(X)^{op}\\to\\mathbf{Set}","Sheaf"],["Zariski 切空间","T_pX=\\operatorname{Hom}(\\mathfrak m_p/\\mathfrak m_p^2,k)","Zariski tangent space"],["C*-代数","\\|a^*a\\|=\\|a\\|^2","C-star algebra"],["平展上同调","H^i_{\\mathrm{et}}(X,\\mathcal F)","Etale cohomology"],["von Neumann 代数","\\mathcal M=\\mathcal M''","Von Neumann algebra"],{"section":"代数几何 / 非交换代数 - 定理 / 公式","sectionEn":"Algebraic Geometry / Noncommutative Algebra - Theorems / Formulas"},["Hilbert 零点定理","I(V(I))=\\sqrt I","Hilbert Nullstellensatz"],["Noether 归一化","A\\text{ finite over }k[x_1,\\ldots,x_d]","Noether normalization"],["Serre 对偶","H^i(X,\\mathcal F)^*\\cong\\operatorname{Ext}^{n-i}(\\mathcal F,\\omega_X)","Serre duality"],["Riemann-Roch","\\ell(D)-\\ell(K-D)=\\deg D+1-g","Riemann-Roch theorem"],["Gelfand-Naimark","A\\cong C_0(X)\\text{ for commutative C*-algebra }A","Gelfand-Naimark theorem"],["Proper base change","R^if_*\\mathcal F\\otimes k(s)\\cong H^i(X_s,\\mathcal F_s)","Proper base change theorem"],["Flat base change","g^*R^if_*\\mathcal F\\cong R^if'_*g'^*\\mathcal F","Flat base change theorem"],["Grothendieck-Riemann-Roch","\\operatorname{ch}(Rf_*E)\\operatorname{Td}(Y)=f_*(\\operatorname{ch}(E)\\operatorname{Td}(X))","Grothendieck-Riemann-Roch"],["Tomita-Takesaki","\\sigma_t^\\varphi(M)=\\Delta_\\varphi^{it}M\\Delta_\\varphi^{-it}","Tomita-Takesaki theory"],["态","\\varphi: A \\to \\mathbb{C}","State"],["表示","\\pi: A \\to \\mathcal{B}(H)","Representation"],["乘子代数","M(A)=\\{(L,R):L(a)b=aR(b)\\}","Multiplier algebra"],["C* 张量积","A \\otimes_{\\min} B","C-star tensor product"],["因子","\\mathcal{M}\\cap\\mathcal{M}' = \\mathbb{C}I","Factor"],["迹","\\tau(ab)=\\tau(ba)","Trace"],["Type I","\\mathcal{M}\\text{ type I}","Type I factor"],["Type II₁","\\tau(1)=1","Type II1 factor"],["Type III","\\mathcal{M}\\text{ type III}","Type III factor"],["K₀","K_0(A) = \\operatorname{Groth}(\\operatorname{Proj}(A))","K0 group"],["K₁","K_1(A) = \\pi_0(\\operatorname{GL}_\\infty(A))","K1 group"],["六项正合列","\\begin{CD}K_0(I)@>>>K_0(A)@>>>K_0(A/I)\\\\@VVV@.@AAA\\\\K_1(A/I)@<<<K_1(A)@<<<K_1(I)\\end{CD}","Six-term exact sequence"],["完全正映射","\\Phi: A \\to B,\\; \\Phi \\otimes \\operatorname{id}_n \\ge 0","Completely positive map"],["Stinespring","\\Phi(a)=V^*\\pi(a)V","Stinespring dilation"],["核 C* 代数","A \\otimes_{\\min} B \\cong A \\otimes_{\\max} B","Nuclear C-star algebra"],["约化群 C* 代数","C_r^*(G)","Reduced group C-star algebra"],["KK-群","KK(A,B)","Kasparov KK-group"],["Kasparov 积","KK(A,B)\\otimes KK(B,C) \\to KK(A,C)","Kasparov product"],["Elliott 分类","\\operatorname{KK}(A,B)_{\\mathrm{nu}} \\cong \\operatorname{Hom}(K_0(A),K_0(B))\\oplus\\operatorname{Ext}(K_1(A),K_1(B))","Elliott classification"]]},{"id":"geometry","structures":true,"items":[{"section":"经典 / 仿射 / 射影几何 - 概念 / 性质","sectionEn":"Classical / Affine / Projective Geometry - Concepts / Properties"},["欧氏距离","d(p,q)=\\|p-q\\|","Euclidean distance"],["两点距离","d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}","Distance between points"],["中点公式","M=\\left(\\frac{x_1+x_2}{2},\\frac{y_1+y_2}{2}\\right)","Midpoint formula"],["斜率","k=\\frac{y_2-y_1}{x_2-x_1}","Slope"],["直线方程","Ax+By+C=0","Line equation"],["点到直线距离","d=\\frac{|Ax_0+By_0+C|}{\\sqrt{A^2+B^2}}","Point-line distance"],["圆方程","(x-a)^2+(y-b)^2=r^2","Circle equation"],["椭圆方程","\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1","Ellipse equation"],["抛物线方程","y^2=2px","Parabola equation"],["双曲线方程","\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=1","Hyperbola equation"],["三角形面积","S=\\frac12 ab\\sin C","Triangle area"],["圆面积","S=\\pi r^2","Circle area"],["球体积","V=\\frac43\\pi r^3","Sphere volume"],["仿射空间","\\mathbb A^n","Affine space"],["射影空间","\\mathbb P^n","Projective space"],["交比","[a,b;c,d]","Cross ratio"],["二次曲面","x^TAx+bx+c=0","Quadric"],{"section":"经典 / 仿射 / 射影几何 - 定理 / 公式","sectionEn":"Classical / Affine / Projective Geometry - Theorems / Formulas"},["勾股定理","a^2+b^2=c^2","Pythagorean theorem"],["正弦定理","\\frac a{\\sin A}=\\frac b{\\sin B}=\\frac c{\\sin C}","Law of sines"],["余弦定理","c^2=a^2+b^2-2ab\\cos C","Law of cosines"],["Heron 公式","\\Delta=\\sqrt{s(s-a)(s-b)(s-c)}","Heron formula"],["Ceva 定理","\\frac{AF}{FB}\\frac{BD}{DC}\\frac{CE}{EA}=1","Ceva theorem"],["Menelaus 定理","\\frac{AF}{FB}\\frac{BD}{DC}\\frac{CE}{EA}=-1","Menelaus theorem"],["Pascal 定理","\\text{opposite side intersections of hexagon on conic are collinear}","Pascal theorem"],["Brianchon 定理","\\text{diagonals of hexagon tangent to conic are concurrent}","Brianchon theorem"],["圆周角定理","\\angle ACB=\\frac12\\angle AOB","Inscribed angle theorem"],["相似三角形","\\frac{AB}{DE}=\\frac{BC}{EF}=\\frac{CA}{FD}","Similar triangles"],["垂径定理","OM\\perp AB\\implies AM=MB","Perpendicular chord theorem"],{"section":"微分流形 / 张量几何 - 概念 / 性质","sectionEn":"Differentiable Manifolds / Tensor Geometry - Concepts / Properties"},["光滑流形","(M,\\mathcal A)\\text{ is a smooth }n\\text{-manifold}","Smooth manifold"],["切空间","T_pM","Tangent space"],["余切空间","T_p^*M","Cotangent space"],["向量场","X\\in\\Gamma(TM)","Vector field"],["张量场","T\\in\\Gamma(T^r_sM)","Tensor field"],["微分形式","\\Omega^k(M)","Differential form"],["外微分","d:\\Omega^k(M)\\to\\Omega^{k+1}(M)","Exterior derivative"],["楔积","\\omega\\wedge\\eta","Wedge product"],["李导数","\\mathcal L_XY=[X,Y]","Lie derivative"],["流","\\varphi_t:M\\to M","Flow"],["参数曲线","\\gamma(t)=(x(t),y(t),z(t))","Parametric curve"],["切向量","T=\\frac{\\gamma'}{\\|\\gamma'\\|}","Unit tangent vector"],["法向量","N=\\frac{T'}{\\|T'\\|}","Principal normal vector"],["曲面参数化","X:U\\subset\\mathbb R^2\\to\\mathbb R^3,\\quad X=X(u,v)","Surface parametrization"],["切平面","T_pS=\\operatorname{span}\\{X_u,X_v\\}","Tangent plane"],["法向量","n=\\frac{X_u\\times X_v}{\\|X_u\\times X_v\\|}","Surface normal"],{"section":"微分流形 / 张量几何 - 定理 / 公式","sectionEn":"Differentiable Manifolds / Tensor Geometry - Theorems / Formulas"},["Stokes 定理","\\int_{\\partial M}\\omega=\\int_M d\\omega","Stokes theorem"],["de Rham 定理","H^k_{\\mathrm{dR}}(M)\\cong H^k(M;\\mathbb R)","de Rham theorem"],["Frobenius 定理","\\mathcal D\\text{ involutive}\\Longleftrightarrow\\mathcal D\\text{ integrable}","Frobenius theorem"],["Sard 定理","\\operatorname{CritVal}(f)\\text{ has measure }0","Sard theorem"],["Whitney 嵌入","M^n\\hookrightarrow\\mathbb R^{2n}","Whitney embedding theorem"],["Whitney 浸入","M^n\\looparrowright\\mathbb R^{2n-1}","Whitney immersion theorem"],["横截性定理","f\\pitchfork S\\text{ after small perturbation}","Transversality theorem"],["管状邻域","\\nu(N)\\supset U\\cong\\text{tubular neighborhood of }N","Tubular neighborhood theorem"],["Ehresmann 纤维化","f:M\\to N\\text{ proper submersion}\\implies f\\text{ locally trivial fibration}","Ehresmann fibration theorem"],["同位延拓","i_t:N\\hookrightarrow M\\implies\\exists \\Phi_t:M\\to M","Isotopy extension theorem"],{"section":"曲线曲面 / 黎曼几何 - 概念 / 性质","sectionEn":"Curves Surfaces / Riemannian Geometry - Concepts / Properties"},["曲率","\\kappa=\\frac{|r'\\times r''|}{|r'|^3}","Curvature"],["挠率","\\tau=\\frac{(r'\\times r'')\\cdot r'''}{|r'\\times r''|^2}","Torsion"],["弧长","s=\\int_a^b\\|\\gamma'(t)\\|dt","Arc length"],["第一基本形式","I=E\\,du^2+2F\\,du\\,dv+G\\,dv^2","First fundamental form"],["第二基本形式","II=L\\,du^2+2M\\,du\\,dv+N\\,dv^2","Second fundamental form"],["面积元","dA=\\|X_u\\times X_v\\|\\,du\\,dv","Surface area element"],["高斯曲率","K=\\frac{LN-M^2}{EG-F^2}","Gaussian curvature"],["平均曲率","H=\\frac{EN+GL-2FM}{2(EG-F^2)}","Mean curvature"],["度量张量","g=g_{ij}dx^i\\otimes dx^j","Metric tensor"],["Levi-Civita 联络","\\nabla g=0,\\quad T^\\nabla=0","Levi-Civita connection"],["测地线","\\ddot x^k+\\Gamma^k_{ij}\\dot x^i\\dot x^j=0","Geodesic"],["Riemann 曲率","R(X,Y)Z=\\nabla_X\\nabla_YZ-\\nabla_Y\\nabla_XZ-\\nabla_{[X,Y]}Z","Riemann curvature"],["Ricci 曲率","\\operatorname{Ric}_{ij}=R^k_{ikj}","Ricci curvature"],["标量曲率","R=g^{ij}\\operatorname{Ric}_{ij}","Scalar curvature"],["截面曲率","K(\\sigma)=\\frac{\\langle R(X,Y)Y,X\\rangle}{|X\\wedge Y|^2}","Sectional curvature"],{"section":"曲线曲面 / 黎曼几何 - 定理 / 公式","sectionEn":"Curves Surfaces / Riemannian Geometry - Theorems / Formulas"},["Frenet-Serret","\\frac d{ds}\\begin{bmatrix}T\\\\N\\\\B\\end{bmatrix}=\\begin{bmatrix}0&\\kappa&0\\\\-\\kappa&0&\\tau\\\\0&-\\tau&0\\end{bmatrix}\\begin{bmatrix}T\\\\N\\\\B\\end{bmatrix}","Frenet-Serret formulas"],["Gauss 绝妙定理","K=\\frac{R_{1212}}{\\det(g_{ij})}","Theorema egregium"],["Gauss-Codazzi","R_{ijkl}=h_{ik}h_{jl}-h_{il}h_{jk},\\quad\\nabla_i h_{jk}=\\nabla_jh_{ik}","Gauss-Codazzi equations"],["Bonnet 定理","g,h\\text{ satisfy Gauss-Codazzi}\\implies\\text{ surface exists}","Bonnet theorem"],["Gauss-Bonnet","\\int_MK\\,dA+\\int_{\\partial M}k_g\\,ds=2\\pi\\chi(M)","Gauss-Bonnet theorem"],["Hopf-Rinow","\\text{geodesically complete}\\Longleftrightarrow\\text{ metric complete}","Hopf-Rinow theorem"],["Cartan-Hadamard","K\\le0,\\;M\\text{ complete simply connected}\\implies\\exp_p:T_pM\\to M","Cartan-Hadamard theorem"],["Bonnet-Myers","\\operatorname{Ric}\\ge(n-1)k>0\\implies\\operatorname{diam}M\\le\\pi/\\sqrt k","Bonnet-Myers theorem"],["Synge 定理","M^{2m}\\text{ orientable},\\;K>0\\implies\\pi_1(M)=0","Synge theorem"],["Rauch 比较","K_M\\le K_N\\implies |J_M|\\ge |J_N|","Rauch comparison theorem"],["Bishop-Gromov","\\frac{\\operatorname{Vol}B(p,r)}{V_k(r)}\\text{ is nonincreasing}","Bishop-Gromov theorem"],["Toponogov 比较","K\\ge k\\implies\\text{geodesic triangles compare with }M_k","Toponogov theorem"],["Cheeger-Gromoll","\\operatorname{Ric}\\ge0\\text{ and line}\\implies M\\cong N\\times\\mathbb R","Cheeger-Gromoll splitting"],["Preissmann 定理","M\\text{ compact},\\;K<0\\implies\\text{nontrivial abelian subgroup of }\\pi_1(M)\\text{ is }\\mathbb Z","Preissmann theorem"],["Cheeger 有限性","|K|\\le C,\\;\\operatorname{diam}\\le D,\\;\\operatorname{vol}\\ge v\\implies\\text{finitely many diffeomorphism types}","Cheeger finiteness theorem"],["Gromov 紧性","\\operatorname{Ric}\\ge(n-1)k,\\;\\operatorname{diam}\\le D\\implies\\text{precompact in GH topology}","Gromov compactness theorem"],{"section":"复几何 / Kähler / 代数几何交界 - 概念 / 性质","sectionEn":"Complex / Kahler / Algebraic Geometry Interface - Concepts / Properties"},["复流形","(M,J)","Complex manifold"],["Kähler 形式","\\omega=g(J\\cdot,\\cdot)","Kahler form"],["Dolbeault 上同调","H^{p,q}_{\\bar\\partial}(M)","Dolbeault cohomology"],["陈类","c_i(E)\\in H^{2i}(M;\\mathbb Z)","Chern class"],["Calabi-Yau","c_1(M)=0","Calabi-Yau manifold"],{"section":"复几何 / Kähler / 代数几何交界 - 定理 / 公式","sectionEn":"Complex / Kahler / Algebraic Geometry Interface - Theorems / Formulas"},["Newlander-Nirenberg","N_J=0\\implies J\\text{ integrable}","Newlander-Nirenberg theorem"],["Hodge 分解","H^k(M;\\mathbb C)=\\bigoplus_{p+q=k}H^{p,q}(M)","Hodge decomposition"],["Lefschetz 超平面","H^i(X)\\cong H^i(Y)\\quad i<\\dim Y","Lefschetz hyperplane theorem"],["Kodaira 消灭","H^q(X,K_X\\otimes L)=0\\quad(q>0)","Kodaira vanishing theorem"],["Calabi-Yau 定理","c_1(M)=0\\implies\\exists\\text{ Ricci-flat Kähler metric}","Calabi-Yau theorem"],{"section":"辛几何 / 接触几何 / Poisson - 概念 / 性质","sectionEn":"Symplectic / Contact / Poisson Geometry - Concepts / Properties"},["辛流形","(M,\\omega),\\quad d\\omega=0","Symplectic manifold"],["Hamilton 向量场","\\iota_{X_H}\\omega=dH","Hamiltonian vector field"],["Poisson 括号","\\{f,g\\}=\\omega(X_f,X_g)","Poisson bracket"],["矩映射","\\mu:M\\to\\mathfrak g^*","Moment map"],["接触形式","\\alpha\\wedge(d\\alpha)^n\\ne0","Contact form"],{"section":"辛几何 / 接触几何 / Poisson - 定理 / 公式","sectionEn":"Symplectic / Contact / Poisson Geometry - Theorems / Formulas"},["Darboux 定理","\\omega=\\sum_i dq_i\\wedge dp_i\\text{ locally}","Darboux theorem"],["Moser 稳定性","[\\omega_t]\\text{ constant}\\implies\\phi_t^*\\omega_t=\\omega_0","Moser stability theorem"],["Marsden-Weinstein 约化","M//G=\\mu^{-1}(0)/G","Marsden-Weinstein reduction"],["Gromov 非挤压","B^{2n}(R)\\hookrightarrow Z^{2n}(r)\\implies R\\le r","Gromov nonsqueezing theorem"],["Arnold 猜想","\\#\\operatorname{Fix}(\\phi_H)\\ge\\sum_i b_i(M)","Arnold conjecture"],["Floer 同调","HF^*(M,\\omega,H)","Floer homology"],["J-全纯曲线","\\bar\\partial_Ju=0","J-holomorphic curve"],["Hofer 范数","\\|\\phi_H\\|=\\inf_H\\int_0^1(\\max H_t-\\min H_t)dt","Hofer norm"],["Gray 稳定性","\\xi_t\\text{ contact structures}\\implies\\phi_t^*\\xi_t=\\xi_0","Gray stability theorem"],["Reeb 向量场","\\alpha(R)=1,\\quad \\iota_Rd\\alpha=0","Reeb vector field"],{"section":"几何分析 / 全局分析 / 规范理论 - 概念 / 性质","sectionEn":"Geometric Analysis / Global Analysis / Gauge Theory - Concepts / Properties"},["Hodge 星","\\star:\\Omega^k(M)\\to\\Omega^{n-k}(M)","Hodge star"],["Hodge Laplacian","\\Delta=d\\delta+\\delta d","Hodge Laplacian"],["Dirac 算子","\\displaystyle{\\not}D=\\gamma^\\mu\\nabla_\\mu","Dirac operator"],["曲率形式","F_\\nabla=dA+A\\wedge A","Curvature form"],["Yang-Mills","D_A^*F_A=0","Yang-Mills equation"],["Ricci 流","\\partial_tg=-2\\operatorname{Ric}(g)","Ricci flow"],["平均曲率流","\\partial_tF=H\\nu","Mean curvature flow"],["调和映射","\\tau(u)=0","Harmonic map"],["极小曲面","H=0","Minimal surface"],["Seiberg-Witten","\\displaystyle{\\not}D_A\\psi=0,\\quad F_A^+=q(\\psi)","Seiberg-Witten equations"],["Uhlenbeck 紧性","A_i\\text{ Yang-Mills bounded}\\implies A_i\\to A\\text{ modulo gauge}","Uhlenbeck compactness"],{"section":"几何分析 / 全局分析 / 规范理论 - 定理 / 公式","sectionEn":"Geometric Analysis / Global Analysis / Gauge Theory - Theorems / Formulas"},["Hodge 定理","H^k_{\\mathrm{dR}}(M)\\cong\\mathcal H^k(M)","Hodge theorem"],["Bochner 公式","\\frac12\\Delta|\\omega|^2=|\\nabla\\omega|^2+\\langle\\Delta\\omega,\\omega\\rangle+\\operatorname{Ric}(\\omega,\\omega)","Bochner formula"],["Weitzenbock 公式","D^2=\\nabla^*\\nabla+\\mathcal R","Weitzenbock formula"],["Atiyah-Singer","\\operatorname{ind}D=\\int_M\\hat A(M)\\operatorname{ch}(E)","Atiyah-Singer index theorem"],["Chern-Weil","P(F_\\nabla)\\text{ represents characteristic classes}","Chern-Weil theorem"],["Gauss-Bonnet-Chern","\\int_M\\operatorname{Pf}(\\Omega)=(2\\pi)^n\\chi(M)","Chern-Gauss-Bonnet theorem"],["Yamabe 问题","\\exists\\tilde g\\in[g]: R_{\\tilde g}\\text{ constant}","Yamabe theorem"],["正质量定理","R_g\\ge0\\implies m_{ADM}\\ge0","Positive mass theorem"],["Donaldson 定理","Q_M\\text{ definite}\\implies Q_M\\cong\\pm I","Donaldson theorem"],["Sacks-Uhlenbeck","\\text{harmonic maps exist after }\\alpha\\text{-energy approximation}","Sacks-Uhlenbeck theorem"],["Eells-Sampson","E(u)=\\frac12\\int_M|du|^2,\\;K_N\\le0\\implies\\exists u\\text{ harmonic}","Eells-Sampson theorem"],["Huisken 单调性","\\frac{d}{dt}\\int_{M_t}\\rho_{x_0,t_0}\\,d\\mu_t\\le0","Huisken monotonicity formula"]]},{"id":"topology","structures":true,"items":[{"section":"点集拓扑 / 度量拓扑 - 概念 / 性质","sectionEn":"Point-Set / Metric Topology - Concepts / Properties"},["拓扑空间","(X,\\mathcal T)","Topological space"],["开集","U\\in\\mathcal T","Open set"],["闭集","F=X\\setminus U","Closed set"],["闭包","\\overline A","Closure"],["内部","\\operatorname{int}A","Interior"],["边界","\\partial A","Boundary"],["邻域","U\\ni x","Neighborhood"],["聚点","x\\in A'","Limit point"],["导集","A'","Derived set"],["紧致","K\\text{ compact}","Compactness"],["连通","X\\text{ connected}","Connectedness"],["道路连通","X\\text{ path connected}","Path connectedness"],["开覆盖","X=\\bigcup_{\\alpha}U_\\alpha","Open cover"],["子空间拓扑","\\mathcal T_A=\\{U\\cap A:U\\in\\mathcal T\\}","Subspace topology"],["积拓扑","\\prod_i X_i","Product topology"],["商拓扑","X/{\\sim}","Quotient topology"],["连续映射","f:X\\to Y\\text{ continuous}","Continuous map"],["同胚","X\\cong Y","Homeomorphism"],["嵌入","f:X\\hookrightarrow Y","Embedding"],["Hausdorff","T_2","Hausdorff space"],["第一可数","X\\text{ first countable}","First countable"],["第二可数","X\\text{ second countable}","Second countable"],["可分空间","X\\text{ separable}","Separable space"],["正规空间","T_4","Normal space"],["仿紧","X\\text{ paracompact}","Paracompactness"],["Stone-Cech 紧化","\\beta X","Stone-Cech compactification"],["覆盖维数","\\dim X","Covering dimension"],{"section":"点集拓扑 / 度量拓扑 - 定理 / 公式","sectionEn":"Point-Set / Metric Topology - Theorems / Formulas"},["Urysohn 引理","A,B\\text{ closed disjoint}\\implies\\exists f:X\\to[0,1]","Urysohn lemma"],["Tietze 扩张","f:A\\to\\mathbb R\\implies\\exists F:X\\to\\mathbb R","Tietze extension theorem"],["Tychonoff 定理","\\prod_i X_i\\text{ compact}","Tychonoff theorem"],["Baire 定理","X\\text{ complete metric}\\implies\\bigcap_nU_n\\text{ dense}","Baire category theorem"],["Alexander 子基","\\mathcal S\\text{ subbase cover}\\implies\\text{ finite subcover}","Alexander subbase theorem"],["Lebesgue 数引理","\\mathcal U\\text{ open cover of compact metric }X\\implies\\exists\\delta>0","Lebesgue number lemma"],["度量化定理","X\\text{ regular second countable}\\implies X\\text{ metrizable}","Urysohn metrization theorem"],["Stone-Cech 泛性质","f:X\\to K\\text{ compact Hausdorff}\\implies\\exists!\\bar f:\\beta X\\to K","Stone-Cech universal property"],["Nagata-Smirnov","X\\text{ metrizable}\\Longleftrightarrow X\\text{ regular with sigma-locally finite base}","Nagata-Smirnov metrization"],["Michael 选择","F:X\\to 2^Y\\text{ l.s.c. convex}\\implies\\exists\\text{ continuous selection}","Michael selection theorem"],{"section":"代数拓扑 / 同调上同调 - 概念 / 性质","sectionEn":"Algebraic Topology / Homology Cohomology - Concepts / Properties"},["同伦","f\\simeq g","Homotopy"],["道路","\\gamma:[0,1]\\to X","Path"],["环路","\\gamma:(S^1,*)\\to(X,x_0)","Loop"],["道路复合","\\gamma*\\eta","Path composition"],["基本群","\\pi_1(X,x_0)","Fundamental group"],["高阶同伦群","\\pi_n(X)","Higher homotopy group"],["覆叠空间","p:\\tilde X\\to X","Covering space"],["万有覆叠","\\tilde X\\to X","Universal cover"],["提升","\\tilde f:Y\\to\\tilde X,\\quad p\\circ\\tilde f=f","Lifting"],["奇异同调","H_n(X;G)","Singular homology"],["上同调","H^n(X;G)","Cohomology"],["杯积","\\smile:H^p\\times H^q\\to H^{p+q}","Cup product"],["链群","C_n(X)","Chain group"],["边界算子","\\partial_n:C_n\\to C_{n-1}","Boundary operator"],["循环","Z_n=\\ker\\partial_n","Cycle group"],["边界","B_n=\\operatorname{im}\\partial_{n+1}","Boundary group"],["相对同调","H_n(X,A)","Relative homology"],["约化同调","\\widetilde H_n(X)","Reduced homology"],["CW 复形","X=\\bigcup_nX^{(n)}","CW complex"],["单纯复形","K","Simplicial complex"],["胞腔复形","X^{(n)}","Cell complex"],["Mayer-Vietoris 序列","\\cdots\\to H_n(A\\cap B)\\to H_n(A)\\oplus H_n(B)\\to H_n(X)\\to\\cdots","Mayer-Vietoris sequence"],{"section":"代数拓扑 / 同调上同调 - 定理 / 公式","sectionEn":"Algebraic Topology / Homology Cohomology - Theorems / Formulas"},["Seifert-van Kampen","\\pi_1(X)\\cong\\pi_1(U)*_{\\pi_1(U\\cap V)}\\pi_1(V)","Seifert-van Kampen theorem"],["切除定理","H_n(X,A)\\cong H_n(X\\setminus Z,A\\setminus Z)","Excision theorem"],["Mayer-Vietoris","\\cdots\\to H_n(A\\cap B)\\to H_n(A)\\oplus H_n(B)\\to H_n(X)\\to\\cdots","Mayer-Vietoris sequence"],["万有系数定理","0\\to H_n(X)\\otimes G\\to H_n(X;G)\\to\\operatorname{Tor}(H_{n-1}(X),G)\\to0","Universal coefficient theorem"],["Kunneth 公式","H_n(X\\times Y)\\cong\\bigoplus_{p+q=n}H_p(X)\\otimes H_q(Y)\\oplus\\operatorname{Tor}","Kunneth formula"],["Poincare 对偶","H^k(M;R)\\cong H_{n-k}(M;R)","Poincare duality"],["Alexander 对偶","\\widetilde H^i(S^n\\setminus A)\\cong\\widetilde H_{n-i-1}(A)","Alexander duality"],["Lefschetz 不动点","L(f)\\ne0\\implies\\operatorname{Fix}(f)\\ne\\varnothing","Lefschetz fixed point theorem"],["Brouwer 不动点","f:D^n\\to D^n\\implies\\exists x=f(x)","Brouwer fixed point theorem"],["Borsuk-Ulam","f:S^n\\to\\mathbb R^n\\implies\\exists x:\\,f(x)=f(-x)","Borsuk-Ulam theorem"],["Eilenberg-Steenrod","H_*\\text{ satisfies homotopy, exactness, excision, dimension}","Eilenberg-Steenrod axioms"],["路径提升","p:\\tilde X\\to X,\\;\\gamma(0)=p(\\tilde x_0)\\implies\\exists!\\tilde\\gamma","Path lifting theorem"],["覆叠分类","\\{\\text{connected coverings of }X\\}\\leftrightarrow\\{H\\le\\pi_1(X)\\}","Classification of covering spaces"],["单纯同调等价","H_n^{\\Delta}(K)\\cong H_n(|K|)","Simplicial homology theorem"],{"section":"同伦论 / 谱序列 / 稳定同伦 - 概念 / 性质","sectionEn":"Homotopy Theory / Spectral Sequences / Stable Homotopy - Concepts / Properties"},["纤维化","F\\to E\\to B","Fibration"],["同伦纤维","\\operatorname{hofib}(f)","Homotopy fiber"],["Postnikov 塔","\\cdots\\to X_n\\to X_{n-1}\\to\\cdots","Postnikov tower"],["谱序列","E_r^{p,q}\\Rightarrow H^{p+q}","Spectral sequence"],["谱","\\mathbb E","Spectrum"],["稳定同伦群","\\pi_n^S","Stable homotopy group"],["Eilenberg-MacLane","K(G,n)","Eilenberg-MacLane space"],["上纤维序列","F\\to E\\to B","Fiber sequence"],["上余纤维序列","A\\to X\\to X/A","Cofiber sequence"],["Brown-Peterson 谱","BP","Brown-Peterson spectrum"],{"section":"同伦论 / 谱序列 / 稳定同伦 - 定理 / 公式","sectionEn":"Homotopy Theory / Spectral Sequences / Stable Homotopy - Theorems / Formulas"},["Hurewicz 定理","\\pi_i(X)=0\\;(i<n)\\implies h:\\pi_n(X)\\cong H_n(X)","Hurewicz theorem"],["Whitehead 定理","f_*:\\pi_n(X)\\cong\\pi_n(Y)\\;\\forall n\\implies f\\text{ homotopy equivalence}","Whitehead theorem"],["Brown 表示","F\\text{ homotopy functor}\\implies F(-)\\cong[-,Y]","Brown representability"],["CW 逼近","\\exists K\\to X\\text{ weak equivalence with }K\\text{ CW}","CW approximation theorem"],["Serre 谱序列","E^2_{p,q}=H_p(B;H_q(F))\\Rightarrow H_{p+q}(E)","Serre spectral sequence"],["Adams 谱序列","\\operatorname{Ext}_{\\mathcal A}^{s,t}(H^*Y,H^*X)\\Rightarrow [X,Y]_{t-s}","Adams spectral sequence"],["Adams-Novikov","\\operatorname{Ext}_{BP_*BP}^{s,t}(BP_*,BP_*)\\Rightarrow\\pi_{t-s}^S","Adams-Novikov spectral sequence"],["Freudenthal 悬垂","\\pi_k(X)\\to\\pi_{k+1}(\\Sigma X)\\text{ stable range iso}","Freudenthal suspension theorem"],["EHP 序列","\\cdots\\to\\pi_{q+1}(S^{2n+1})\\xrightarrow{P}\\pi_{q-1}(S^n)\\xrightarrow{E}\\pi_q(S^{n+1})\\xrightarrow{H}\\cdots","EHP sequence"],{"section":"纤维丛 / 示性类 / K 理论 - 概念 / 性质","sectionEn":"Bundles / Characteristic Classes / K-Theory - Concepts / Properties"},["纤维丛","F\\to E\\xrightarrow{\\pi}B","Fiber bundle"],["向量丛","E\\to B","Vector bundle"],["主丛","P\\to B","Principal bundle"],["分类空间","BG","Classifying space"],["Thom 类","u_E\\in H^n(E,E\\setminus B)","Thom class"],["Euler 类","e(E)\\in H^n(B)","Euler class"],["Stiefel-Whitney 类","w_i(E)\\in H^i(B;\\mathbb Z_2)","Stiefel-Whitney class"],["Chern 类","c_i(E)\\in H^{2i}(B;\\mathbb Z)","Chern class"],["Pontryagin 类","p_i(E)\\in H^{4i}(B;\\mathbb Z)","Pontryagin class"],["K 理论","K^0(X)","K-theory"],["Wu 类","v_i\\in H^i(M;\\mathbb Z_2)","Wu class"],["Todd 类","\\operatorname{Td}(E)","Todd class"],["A-hat 属","\\hat A(M)=\\prod_i\\frac{x_i/2}{\\sinh(x_i/2)}","A-hat genus"],["L-属","L(M)=\\prod_i\\frac{x_i}{\\tanh x_i}","L-genus"],["Chern 特征","\\operatorname{ch}:K(X)\\to H^{\\mathrm{even}}(X;\\mathbb Q)","Chern character"],{"section":"纤维丛 / 示性类 / K 理论 - 定理 / 公式","sectionEn":"Bundles / Characteristic Classes / K-Theory - Theorems / Formulas"},["Thom 同构","H^k(B)\\cong H^{k+n}(E,E\\setminus B)","Thom isomorphism"],["Gysin 序列","\\cdots\\to H^k(B)\\to H^k(E)\\to H^{k-n+1}(B)\\to\\cdots","Gysin sequence"],["Whitney 乘积公式","w(E\\oplus F)=w(E)w(F),\\quad c(E\\oplus F)=c(E)c(F)","Whitney product formula"],["Chern-Weil","P(F_\\nabla)\\text{ represents characteristic classes}","Chern-Weil theorem"],["Bott 周期性","K^{i+2}(X)\\cong K^i(X)","Bott periodicity"],["Atiyah-Hirzebruch 谱序列","E_2^{p,q}=H^p(X;K^q(*))\\Rightarrow K^{p+q}(X)","Atiyah-Hirzebruch spectral sequence"],["Hirzebruch 签名","\\sigma(M)=\\langle L(M),[M]\\rangle","Hirzebruch signature theorem"],["Riemann-Roch-Hirzebruch","\\chi(E)=\\int_X\\operatorname{ch}(E)\\operatorname{Td}(TX)","Hirzebruch-Riemann-Roch"],{"section":"微分拓扑 / Morse 理论 / 流形拓扑 - 概念 / 性质","sectionEn":"Differential Topology / Morse Theory / Manifold Topology - Concepts / Properties"},["光滑映射","f:M\\to N","Smooth map"],["映射度","\\deg f","Mapping degree"],["横截","f\\pitchfork S","Transversality"],["Morse 函数","f:M\\to\\mathbb R\\text{ Morse}","Morse function"],["临界点指数","\\operatorname{ind}_p(f)","Morse index"],["柄分解","M=\\bigcup\\text{ handles}","Handle decomposition"],["配边","W:\\;\\partial W=M_0\\sqcup M_1","Cobordism"],["手术","\\chi:S^k\\times D^{n-k}\\hookrightarrow M","Surgery"],["奇异球面","\\Sigma^n\\simeq S^n,\\;\\Sigma^n\\not\\cong S^n","Exotic sphere"],["Kirby 图","\\text{framed link diagram}","Kirby diagram"],{"section":"微分拓扑 / Morse 理论 / 流形拓扑 - 定理 / 公式","sectionEn":"Differential Topology / Morse Theory / Manifold Topology - Theorems / Formulas"},["Poincaré-Hopf","\\sum_{p\\in\\operatorname{Zero}(X)}\\operatorname{ind}_p(X)=\\chi(M)","Poincare-Hopf theorem"],["庞加莱-霍普夫指标","\\operatorname{Ind}(X)=\\chi(M)","Poincare-Hopf index theorem"],["Morse 引理","f=f(p)-x_1^2-\\cdots-x_\\lambda^2+x_{\\lambda+1}^2+\\cdots+x_n^2","Morse lemma"],["Morse 不等式","M_k-M_{k-1}+\\cdots\\ge b_k-b_{k-1}+\\cdots","Morse inequalities"],["Sard 定理","\\operatorname{CritVal}(f)\\text{ has measure }0","Sard theorem"],["Thom 横截性","\\{f:f\\pitchfork S\\}\\text{ is residual}","Thom transversality theorem"],["h-cobordism","W\\text{ h-cobordism},\\;\\dim W\\ge6\\implies W\\cong M\\times[0,1]","h-cobordism theorem"],["Poincare 猜想","M^3\\simeq S^3\\implies M^3\\cong S^3","Poincare conjecture"],["手术正合列","\\cdots\\to\\mathcal S(M)\\to [M,G/O]\\to L_n(\\pi_1M)","Surgery exact sequence"],["Kervaire-Milnor","\\Theta_n\\text{ finite abelian group of homotopy spheres}","Kervaire-Milnor theorem"],["Kirby 演算","M\\cong M'\\Longleftrightarrow\\text{Kirby moves relate diagrams}","Kirby calculus"],{"section":"低维拓扑 / 纽结 / 几何拓扑 - 概念 / 性质","sectionEn":"Low-Dimensional / Knot / Geometric Topology - Concepts / Properties"},["纽结","K:S^1\\hookrightarrow S^3","Knot"],["链环","L=K_1\\sqcup\\cdots\\sqcup K_m","Link"],["Seifert 曲面","\\partial\\Sigma=K","Seifert surface"],["Heegaard 分解","M=H_g\\cup_\\phi H_g","Heegaard splitting"],["Dehn surgery","M_{p/q}(K)","Dehn surgery"],["双曲流形","M=\\mathbb H^n/\\Gamma","Hyperbolic manifold"],["Thurston 范数","x(\\alpha)=\\min\\{-\\chi_-(S):[S]=\\alpha\\}","Thurston norm"],["Seiberg-Witten Floer","HM_*(Y,\\mathfrak s)","Seiberg-Witten Floer homology"],{"section":"低维拓扑 / 纽结 / 几何拓扑 - 定理 / 公式","sectionEn":"Low-Dimensional / Knot / Geometric Topology - Theorems / Formulas"},["Reidemeister 移动","K\\sim K'\\Longleftrightarrow\\text{Reidemeister moves}","Reidemeister theorem"],["Alexander 多项式","\\Delta_K(t)","Alexander polynomial"],["Jones 多项式","V_K(t)","Jones polynomial"],["HOMFLY 多项式","P_L(a,z)","HOMFLY polynomial"],["纽结签名","\\sigma(K)","Knot signature"],["纽结 Floer","\\widehat{HFK}(K)","Knot Floer homology"],["Khovanov 同调","\\operatorname{Kh}(K)","Khovanov homology"],["JSJ 分解","M=\\bigcup\\text{Seifert and atoroidal pieces}","JSJ decomposition"],["Geometrization","M^3\\text{ decomposes into Thurston geometries}","Geometrization theorem"],["Dehn surgery 定理","M_{p/q}(K)\\text{ changes topology by slope }p/q","Dehn surgery theorem"],{"section":"配边 / TQFT / 几何群论 - 概念 / 性质","sectionEn":"Cobordism / TQFT / Geometric Group Theory - Concepts / Properties"},["TQFT","Z:\\operatorname{Cob}_d\\to\\operatorname{Vect}","Topological quantum field theory"],["Floer 同调","HF(Y,\\mathfrak s)","Floer homology"],["Gromov 双曲群","G\\text{ is }\\delta\\text{-hyperbolic}","Gromov hyperbolic group"],["拟等距","d_Y(fx,fx')\\simeq d_X(x,x')","Quasi-isometry"],["粗几何","\\text{large scale geometry of metric spaces}","Coarse geometry"],["双曲群边界","\\partial G","Boundary of hyperbolic group"],{"section":"配边 / TQFT / 几何群论 - 定理 / 公式","sectionEn":"Cobordism / TQFT / Geometric Group Theory - Theorems / Formulas"},["Pontryagin-Thom","\\Omega_n^{fr}\\cong\\pi_n^S","Pontryagin-Thom theorem"],["Rohlin 定理","\\sigma(M^4)\\equiv0\\pmod{16}","Rohlin theorem"],["Atiyah-Segal 公理","Z(M\\sqcup N)=Z(M)\\otimes Z(N)","Atiyah-Segal axioms"],["Gromov 紧性","\\mathcal M(J,A)\\text{ compact up to bubbling}","Gromov compactness"],["Baum-Connes","K_*^G(\\underline EG)\\cong K_*(C_r^*(G))","Baum-Connes conjecture"],["Novikov 猜想","\\text{higher signatures are homotopy invariant}","Novikov conjecture"]]},{"id":"numberTheory","structures":true,"items":[{"section":"初等数论 - 概念 / 性质","sectionEn":"Elementary Number Theory - Concepts / Properties"},["整除","a\\mid b","Divisibility"],["最大公因数","\\gcd(a,b)","Greatest common divisor"],["最小公倍数","\\operatorname{lcm}(a,b)","Least common multiple"],["互素","\\gcd(a,b)=1","Coprime integers"],["同余","a\\equiv b\\pmod m","Congruence"],["剩余类","\\mathbb Z/n\\mathbb Z","Residue class"],["Euler 函数","\\varphi(n)=n\\prod_{p\\mid n}\\left(1-\\frac1p\\right)","Euler phi function"],["Mobius 函数","\\mu(n)=\\begin{cases}1,&n=1\\\\(-1)^k,&n=p_1\\cdots p_k\\\\0,&p^2\\mid n\\end{cases}","Mobius function"],["Legendre 符号","\\left(\\frac{a}{p}\\right)\\equiv a^{(p-1)/2}\\pmod p","Legendre symbol"],["Jacobi 符号","\\left(\\frac{a}{n}\\right)=\\prod_{p_i^{\\alpha_i}\\|n}\\left(\\frac{a}{p_i}\\right)^{\\alpha_i}","Jacobi symbol"],["素数","p\\in\\mathbb P","Prime number"],["合数","n=ab,\\quad 1<a,b<n","Composite number"],["平方因子自由","\\mu(n)^2=1","Squarefree integer"],["p 进赋值","v_p(n)=\\max\\{k:p^k\\mid n\\}","p-adic valuation"],["约数个数","d(n)=\\sum_{d\\mid n}1","Divisor function"],["约数和","\\sigma_k(n)=\\sum_{d\\mid n}d^k","Sum of divisors"],["完全数","\\sigma(n)=2n","Perfect number"],["Carmichael 函数","\\lambda(n)=\\operatorname{lcm}_{p^a\\|n}\\lambda(p^a)","Carmichael function"],["阶","\\operatorname{ord}_n(a)=\\min\\{k:a^k\\equiv1\\pmod n\\}","Multiplicative order"],["原根","\\operatorname{ord}_p(g)=p-1","Primitive root"],["二次剩余","x^2\\equiv a\\pmod p","Quadratic residue"],{"section":"初等数论 - 定理 / 公式","sectionEn":"Elementary Number Theory - Theorems / Formulas"},["Euclid 算法","\\gcd(a,b)=\\gcd(b,a\\bmod b)","Euclidean algorithm"],["Bezout 等式","\\exists x,y:\\;ax+by=\\gcd(a,b)","Bezout identity"],["唯一分解","n=\\prod_i p_i^{\\alpha_i}","Fundamental theorem of arithmetic"],["Euler 定理","a^{\\varphi(n)}\\equiv1\\pmod n","Euler theorem"],["Fermat 小定理","a^{p-1}\\equiv1\\pmod p","Fermat little theorem"],["Wilson 定理","(p-1)!\\equiv-1\\pmod p","Wilson theorem"],["中国剩余定理","x\\equiv a_i\\pmod{m_i}\\implies x\\pmod{\\prod_i m_i}","Chinese remainder theorem"],["二次互反律","\\left(\\frac pq\\right)\\left(\\frac qp\\right)=(-1)^{\\frac{p-1}{2}\\frac{q-1}{2}}","Quadratic reciprocity"],["Euler 判别准则","\\left(\\frac ap\\right)\\equiv a^{(p-1)/2}\\pmod p","Euler criterion"],["Hensel 引理","f(a)\\equiv0\\pmod p,\\;f'(a)\\not\\equiv0\\pmod p\\implies\\exists \\alpha\\in\\mathbb Z_p:f(\\alpha)=0","Hensel lemma"],["LTE 引理","v_p(x^n-y^n)=v_p(x-y)+v_p(n)","Lifting the exponent"],["Fermat 两平方","p=x^2+y^2\\Longleftrightarrow p=2\\text{ or }p\\equiv1\\pmod4","Fermat two-square theorem"],["Lagrange 四平方","n=a^2+b^2+c^2+d^2","Lagrange four-square theorem"],["Pell 方程","x^2-Dy^2=1","Pell equation"],["勾股三元组","a=m^2-n^2,\\;b=2mn,\\;c=m^2+n^2","Pythagorean triples"],["Frobenius 数","g(a,b)=ab-a-b","Frobenius number"],{"section":"解析数论 - 概念 / 性质","sectionEn":"Analytic Number Theory - Concepts / Properties"},["素数计数函数","\\pi(x)=\\#\\{p\\le x:p\\text{ prime}\\}","Prime counting function"],["Riemann zeta","\\zeta(s)=\\sum_{n=1}^{\\infty}\\frac1{n^s}","Riemann zeta function"],["Dirichlet 级数","\\sum_{n=1}^{\\infty}\\frac{a_n}{n^s}","Dirichlet series"],["Dirichlet 特征","\\chi:\\mathbb Z\\to\\mathbb C","Dirichlet character"],["L 函数","L(s,\\chi)=\\sum_{n=1}^{\\infty}\\frac{\\chi(n)}{n^s}","Dirichlet L-function"],["von Mangoldt","\\Lambda(n)=\\begin{cases}\\log p,&n=p^k\\\\0,&\\text{otherwise}\\end{cases}","von Mangoldt function"],["Chebyshev 函数","\\psi(x)=\\sum_{n\\le x}\\Lambda(n)","Chebyshev psi function"],["算术函数卷积","(f*g)(n)=\\sum_{d\\mid n}f(d)g(n/d)","Dirichlet convolution"],["乘法函数","\\gcd(m,n)=1\\implies f(mn)=f(m)f(n)","Multiplicative function"],["完全乘法函数","f(mn)=f(m)f(n)","Completely multiplicative function"],["Ramanujan 和","c_q(n)=\\sum_{\\substack{1\\le a\\le q\\\\(a,q)=1}}e^{2\\pi ian/q}","Ramanujan sum"],["Hardy-Littlewood 圆法","\\int_0^1 S(\\alpha)^k e(-n\\alpha)\\,d\\alpha","Circle method"],["筛函数","S(z)=\\#\\{n\\le x:(n,P(z))=1\\}","Sieve function"],{"section":"解析数论 - 定理 / 公式","sectionEn":"Analytic Number Theory - Theorems / Formulas"},["素数定理","\\pi(x)\\sim\\frac{x}{\\log x}","Prime number theorem"],["Hadamard 乘积","\\xi(s)=\\xi(0)\\prod_\\rho\\left(1-\\frac{s}{\\rho}\\right)","Hadamard product"],["zeta 函数方程","\\zeta(s)=2^s\\pi^{s-1}\\sin\\frac{\\pi s}{2}\\Gamma(1-s)\\zeta(1-s)","Zeta functional equation"],["显式公式","\\psi(x)=x-\\sum_\\rho\\frac{x^\\rho}{\\rho}+\\cdots","Explicit formula"],["Dirichlet 定理","\\gcd(a,q)=1\\implies\\#\\{p\\equiv a\\pmod q\\}=\\infty","Dirichlet theorem"],["Mobius 反演","g(n)=\\sum_{d\\mid n}f(d)\\implies f(n)=\\sum_{d\\mid n}\\mu(d)g(n/d)","Mobius inversion"],["Euler 乘积","\\zeta(s)=\\prod_p\\left(1-p^{-s}\\right)^{-1}","Euler product"],["Selberg 筛","S(z)\\le X\\prod_{p<z}\\left(1-\\frac{\\omega(p)}p\\right)","Selberg sieve"],["Brun 定理","\\sum_{p,\\,p+2\\text{ prime}}\\left(\\frac1p+\\frac1{p+2}\\right)<\\infty","Brun theorem"],["Waring 问题","n=x_1^k+\\cdots+x_s^k","Waring problem"],["Vinogradov 三素数","N=p_1+p_2+p_3","Vinogradov theorem"],["Riemann 假设","\\zeta(s)=0,\\;0<\\operatorname{Re}s<1\\implies\\operatorname{Re}s=\\frac12","Riemann hypothesis"],{"section":"加性 / 组合数论 - 概念 / 性质","sectionEn":"Additive / Combinatorial Number Theory - Concepts / Properties"},["和集","A+B=\\{a+b:a\\in A,b\\in B\\}","Sumset"],["差集","A-A=\\{a-a':a,a'\\in A\\}","Difference set"],["加性能量","E(A)=\\#\\{a+b=c+d:a,b,c,d\\in A\\}","Additive energy"],["Freiman 同态","\\sum_{i=1}^k a_i=\\sum_{i=1}^k b_i\\implies\\sum_{i=1}^k\\phi(a_i)=\\sum_{i=1}^k\\phi(b_i)","Freiman homomorphism"],["密度","\\overline d(A)=\\limsup_{N\\to\\infty}\\frac{|A\\cap[1,N]|}{N}","Upper density"],["指数和","S(\\alpha)=\\sum_{n\\le N}e^{2\\pi i\\alpha n}","Exponential sum"],{"section":"加性 / 组合数论 - 定理 / 公式","sectionEn":"Additive / Combinatorial Number Theory - Theorems / Formulas"},["Cauchy-Davenport","|A+B|\\ge\\min(p,|A|+|B|-1)","Cauchy-Davenport theorem"],["Plunnecke 不等式","|A+kB|\\le K^k|A|","Plunnecke inequality"],["Freiman 定理","|A+A|\\le K|A|\\implies A\\subset P","Freiman theorem"],["Szemeredi 定理","\\overline d(A)>0\\implies A\\text{ contains arbitrarily long APs}","Szemeredi theorem"],["van der Waerden","N\\to(r,k)\\implies\\text{monochromatic }k\\text{-AP}","van der Waerden theorem"],["Erdos-Ginzburg-Ziv","a_1,\\ldots,a_{2n-1}\\in\\mathbb Z/n\\mathbb Z\\implies\\exists n\\text{ terms summing }0","Erdos-Ginzburg-Ziv theorem"],["Green-Tao","\\mathbb P\\text{ contains arbitrarily long APs}","Green-Tao theorem"],{"section":"代数数论 / 算术几何 - 概念 / 性质","sectionEn":"Algebraic Number Theory / Arithmetic Geometry - Concepts / Properties"},["数域","K/\\mathbb Q","Number field"],["整数环","\\mathcal O_K","Ring of integers"],["理想类群","\\operatorname{Cl}(K)","Ideal class group"],["单位群","\\mathcal O_K^\\times","Unit group"],["赋值","v_p(x)","Valuation"],["局部域","K_v","Local field"],["判别式","d_K=\\det\\left(\\operatorname{Tr}_{K/\\mathbb Q}(\\alpha_i\\alpha_j)\\right)","Discriminant"],["范数","N_{K/\\mathbb Q}(\\alpha)=\\prod_{\\sigma:K\\hookrightarrow\\mathbb C}\\sigma(\\alpha)","Field norm"],["迹","\\operatorname{Tr}_{K/\\mathbb Q}(\\alpha)=\\sum_{\\sigma:K\\hookrightarrow\\mathbb C}\\sigma(\\alpha)","Field trace"],["理想范数","N\\mathfrak a=[\\mathcal O_K:\\mathfrak a]","Ideal norm"],["分歧指数","e(\\mathfrak p|p)","Ramification index"],["惯性次数","f(\\mathfrak p|p)=[\\mathcal O_K/\\mathfrak p:\\mathbb F_p]","Inertia degree"],["不同理想","\\mathfrak D_{K/\\mathbb Q}^{-1}=\\{x:\\operatorname{Tr}(x\\mathcal O_K)\\subset\\mathbb Z\\}","Different ideal"],["Artin 符号","\\left[\\frac{L/K}{\\mathfrak p}\\right]\\in\\operatorname{Gal}(L/K)","Artin symbol"],["p 进绝对值","|x|_p=p^{-v_p(x)}","p-adic absolute value"],["Haar 测度","\\mu(a+p^n\\mathbb Z_p)=p^{-n}","p-adic Haar measure"],["椭圆曲线","E:y^2=x^3+ax+b","Elliptic curve"],["椭圆判别式","\\Delta=-16(4a^3+27b^2)","Elliptic discriminant"],["j 不变量","j(E)=1728\\frac{4a^3}{4a^3+27b^2}","j-invariant"],["Tate 模","T_\\ell(E)=\\varprojlim_n E[\\ell^n]","Tate module"],["Selmer 群","\\operatorname{Sel}^{(n)}(E/K)\\subset H^1(K,E[n])","Selmer group"],["Tate-Shafarevich","\\Sha(E/K)=\\ker\\left(H^1(K,E)\\to\\prod_vH^1(K_v,E)\\right)","Tate-Shafarevich group"],{"section":"代数数论 / 算术几何 - 定理 / 公式","sectionEn":"Algebraic Number Theory / Arithmetic Geometry - Theorems / Formulas"},["Dedekind 分解","p\\mathcal O_K=\\prod_i\\mathfrak p_i^{e_i}","Prime ideal factorization"],["分解恒等式","[K:\\mathbb Q]=\\sum_i e_if_i","Decomposition identity"],["Minkowski 界","\\forall[\\mathfrak a]\\in\\operatorname{Cl}(K)\\;\\exists\\mathfrak b:\\;N\\mathfrak b\\le\\frac{4^{r_2}}{\\pi^{r_2}}\\frac{n!}{n^n}\\sqrt{|d_K|}","Minkowski bound"],["Dirichlet 单位","\\mathcal O_K^\\times\\cong\\mu_K\\times\\mathbb Z^{r_1+r_2-1}","Dirichlet unit theorem"],["类数公式","\\operatorname*{Res}_{s=1}\\zeta_K(s)=\\frac{2^{r_1}(2\\pi)^{r_2}h_KR_K}{w_K\\sqrt{|d_K|}}","Class number formula"],["局部类域论","K^\\times\\xrightarrow{\\operatorname{rec}_K}G_K^{\\mathrm{ab}}","Local class field theory"],["全局类域论","\\mathbb A_K^\\times/K^\\times\\xrightarrow{\\operatorname{rec}_K}G_K^{\\mathrm{ab}}","Global class field theory"],["乘积公式","\\prod_v|x|_v=1","Product formula"],["Riemann-Roch 曲线","\\ell(D)-\\ell(K-D)=\\deg D+1-g","Riemann-Roch for curves"],["Hasse 界","|\\#E(\\mathbb F_q)-(q+1)|\\le2\\sqrt q","Hasse bound"],["Weil 猜想","Z(X,t)=\\exp\\left(\\sum_{r\\ge1}\\#X(\\mathbb F_{q^r})\\frac{t^r}{r}\\right)","Weil conjectures"],["Mordell-Weil","E(K)\\cong\\mathbb Z^r\\oplus E(K)_{\\mathrm{tors}}","Mordell-Weil theorem"],["Nagell-Lutz","P\\in E(\\mathbb Q)_{\\mathrm{tors}}\\implies x(P),y(P)\\in\\mathbb Z,\\; y(P)^2\\mid\\Delta","Nagell-Lutz theorem"],["Faltings 定理","g(C)>1\\implies |C(K)|<\\infty","Faltings theorem"],["BSD 猜想","\\operatorname{ord}_{s=1}L(E,s)=\\operatorname{rank}E(\\mathbb Q)","Birch-Swinnerton-Dyer conjecture"],{"section":"p-adic / Iwasawa 理论 - 概念 / 性质","sectionEn":"p-adic / Iwasawa Theory - Concepts / Properties"},["p 进数","\\mathbb Q_p=\\operatorname{Frac}(\\mathbb Z_p)","p-adic numbers"],["p 进整数","\\mathbb Z_p=\\varprojlim_n\\mathbb Z/p^n\\mathbb Z","p-adic integers"],["p 进展开","x=\\sum_{n=N}^{\\infty}a_np^n","p-adic expansion"],["Teichmuller 提升","\\omega(a)^{p}=\\omega(a)","Teichmuller lift"],["Iwasawa 代数","\\Lambda=\\mathbb Z_p[[\\Gamma]]","Iwasawa algebra"],["圆分 Zp 扩张","\\operatorname{Gal}(K_\\infty/K)\\cong\\mathbb Z_p","Cyclotomic Zp-extension"],["Selmer 对偶","X(E/K_\\infty)=\\operatorname{Hom}(\\operatorname{Sel}(E/K_\\infty),\\mathbb Q_p/\\mathbb Z_p)","Dual Selmer group"],["p 进 L 函数","L_p(\\chi,1-n)=\\left(1-\\chi\\omega^{-n}(p)p^{n-1}\\right)L(\\chi\\omega^{-n},1-n)","p-adic L-function"],{"section":"p-adic / Iwasawa 理论 - 定理 / 公式","sectionEn":"p-adic / Iwasawa Theory - Theorems / Formulas"},["Mahler 展开","f(x)=\\sum_{n=0}^{\\infty}a_n\\binom{x}{n}","Mahler expansion"],["Iwasawa 类数","v_p(h_n)=\\lambda n+\\mu p^n+\\nu","Iwasawa class number formula"],["主猜想","\\operatorname{char}_\\Lambda X=(L_p)","Iwasawa main conjecture"],["Kummer 同构","K^\\times/(K^\\times)^n\\cong H^1(K,\\mu_n)","Kummer isomorphism"],["Tate 对偶","H^i(K,M)\\times H^{2-i}(K,M^\\vee)\\to\\mathbb Q/\\mathbb Z","Tate duality"],{"section":"模形式 / 表示 - 概念 / 性质","sectionEn":"Modular Forms / Representations - Concepts / Properties"},["模形式","f\\left(\\frac{az+b}{cz+d}\\right)=(cz+d)^k f(z)","Modular form"],["尖点形式","f\\in S_k(\\Gamma)","Cusp form"],["Eisenstein 级数","E_k(z)=\\frac12\\sum_{(c,d)=1}(cz+d)^{-k}","Eisenstein series"],["Dedekind eta","\\eta(z)=q^{1/24}\\prod_{n=1}^\\infty(1-q^n)","Dedekind eta function"],["判别式模形式","\\Delta(z)=q\\prod_{n=1}^\\infty(1-q^n)^{24}","Modular discriminant"],["Hecke 算子","(T_nf)(z)=n^{k-1}\\sum_{ad=n}d^{-k}\\sum_{b\\bmod d}f\\left(\\frac{az+b}{d}\\right)","Hecke operator"],["q 展开","f(q)=\\sum_{n=0}^{\\infty}a_nq^n","q-expansion"],["Petersson 内积","\\langle f,g\\rangle=\\int_{\\Gamma\\backslash\\mathbb H}f(z)\\overline{g(z)}y^k\\frac{dx\\,dy}{y^2}","Petersson inner product"],["Mellin 变换","L(f,s)=\\sum_{n\\ge1}\\frac{a_n}{n^s}","Modular L-function"],["Hecke 递推","a_{mn}=a_ma_n\\;(m,n)=1,\\quad a_{p^{r+1}}=a_pa_{p^r}-p^{k-1}a_{p^{r-1}}","Hecke recurrence"],["Galois 表示","\\rho:G_K\\to GL_n(E)","Galois representation"],["Frobenius 迹","a_p=p+1-\\#E(\\mathbb F_p)","Frobenius trace"],["Artin L 函数","L(s,\\rho)=\\prod_p\\det\\left(1-\\rho(\\operatorname{Frob}_p)p^{-s}\\right)^{-1}","Artin L-function"],{"section":"模形式 / 表示 - 定理 / 公式","sectionEn":"Modular Forms / Representations - Theorems / Formulas"},["模性定理","E/\\mathbb Q\\implies L(E,s)=L(f,s)","Modularity theorem"],["Valence 公式","\\sum_{p\\in\\Gamma\\backslash\\mathbb H}\\frac{v_p(f)}{e_p}+\\sum_{c}v_c(f)=\\frac{k}{12}[SL_2(\\mathbb Z):\\Gamma]","Valence formula"],["Sturm 界","a_n(f)=a_n(g)\\;(n\\le B)\\implies f=g","Sturm bound"],["Eichler-Shimura","T_p=p+1-\\operatorname{Frob}_p-\\operatorname{Ver}_p","Eichler-Shimura relation"],["Sato-Tate","\\frac{a_p}{2\\sqrt p}\\text{ equidistributes by }\\frac2\\pi\\sqrt{1-t^2}dt","Sato-Tate theorem"],["Langlands 对应","\\text{automorphic representations}\\leftrightarrow\\text{Galois representations}","Langlands correspondence"],{"section":"计算数论 / 密码学 - 概念 / 性质","sectionEn":"Computational Number Theory / Cryptography - Concepts / Properties"},["模逆元","a^{-1}\\pmod n","Modular inverse"],["离散对数","g^x\\equiv h\\pmod p","Discrete logarithm"],["原根群","(\\mathbb Z/p\\mathbb Z)^\\times=\\langle g\\rangle","Cyclic unit group"],["有限域","\\mathbb F_q","Finite field"],["有限域乘法群","\\mathbb F_q^\\times\\cong C_{q-1}","Finite field unit group"],["椭圆曲线群律","P+Q=R","Elliptic curve group law"],["ECDLP","Q=kP","Elliptic curve discrete log"],["RSA 模数","N=pq","RSA modulus"],["公私钥关系","ed\\equiv1\\pmod{\\varphi(N)}","RSA key relation"],["Diffie-Hellman","K=g^{ab}\\pmod p","Diffie-Hellman key"],{"section":"计算数论 / 密码学 - 算法 / 公式","sectionEn":"Computational Number Theory / Cryptography - Algorithms / Formulas"},["扩展 Euclid","ax+by=\\gcd(a,b)","Extended Euclidean algorithm"],["快速幂","a^n\\bmod m","Fast modular exponentiation"],["Miller-Rabin","a^d\\equiv1\\pmod n\\;\\text{or}\\;a^{2^rd}\\equiv-1\\pmod n","Miller-Rabin test"],["AKS 判定","(x+a)^n\\equiv x^n+a\\pmod{(n,x^r-1)}","AKS primality test"],["Pollard rho","x_{i+1}=f(x_i)\\pmod n","Pollard rho"],["二次筛","x^2\\equiv y^2\\pmod N","Quadratic sieve"],["数域筛","\\prod_i(a_i-b_i\\alpha)\\text{ smooth}","Number field sieve"],["RSA 加密","c\\equiv m^e\\pmod N","RSA encryption"],["RSA 解密","m\\equiv c^d\\pmod N","RSA decryption"],["ElGamal","c_1=g^k,\\quad c_2=mh^k","ElGamal encryption"],["ECDSA 签名","s\\equiv k^{-1}(H(m)+rd)\\pmod n","ECDSA signature"],["Shor 阶查找","a^r\\equiv1\\pmod N","Shor order finding"]]},{"id":"relations","structures":false,"items":[["=","="],["≠","\\neq"],["<","<"],[">",">"],["≤","\\leq"],["≥","\\geq"],["≈","\\approx"],["∼","\\sim"],["≡","\\equiv"],["≅","\\cong"],["≃","\\simeq"],["∝","\\propto"],["≍","\\asymp"],["≪","\\ll"],["≫","\\gg"],["≦","\\leqq"],["≧","\\geqq"],["⩽","\\leqslant"],["⩾","\\geqslant"],["≲","\\lesssim"],["≳","\\gtrsim"],["⪅","\\lessapprox"],["⪆","\\gtrapprox"],["≶","\\lessgtr"],["≷","\\gtrless"],["⋚","\\lesseqgtr"],["⋛","\\gtreqless"],["∈","\\in"],["∉","\\notin"],["∋","\\ni"],["⊂","\\subset"],["⊃","\\supset"],["⊆","\\subseteq"],["⊇","\\supseteq"],["⊊","\\subsetneq"],["⊋","\\supsetneq"],["⊄","\\not\\subset"],["⊅","\\not\\supset"],["⊈","\\nsubseteq"],["⊉","\\nsupseteq"],["⊏","\\sqsubset"],["⊐","\\sqsupset"],["⊑","\\sqsubseteq"],["⊒","\\sqsupseteq"],["≺","\\prec"],["≻","\\succ"],["≼","\\preceq"],["≽","\\succeq"],["⋞","\\preccurlyeq"],["⋟","\\succcurlyeq"],["∥","\\parallel"],["∦","\\nparallel"],["⊥","\\perp"],["∣","\\mid"],["∤","\\nmid"],["⌣","\\smallsmile"],["⌢","\\smallfrown"],["∴","\\therefore"],["∵","\\because"],["≔","\\coloneqq"],["≕","\\eqqcolon"],["≜","\\triangleq"],["≑","\\doteqdot"],["≐","\\doteq"],["≗","\\circeq"],["≖","\\eqcirc"],["≘","\\arceq"],["≙","\\widehat{=}"],["≚","\\veeeq"],["≒","\\fallingdotseq"],["≓","\\risingdotseq"],["≊","\\approxeq"],["≉","\\napprox"],["≄","\\nsimeq"],["≇","\\ncong"],["≁","\\nsim"],["⋠","\\npreceq"],["⋡","\\nsucceq"],["⊲","\\vartriangleleft"],["⊳","\\vartriangleright"],["⊴","\\trianglelefteq"],["⊵","\\trianglerighteq"],["⋈","\\bowtie"],["⋉","\\ltimes"],["⋊","\\rtimes"],["≬","\\between"],["⋍","\\backsimeq"],["⊨","\\models"],["⊢","\\vdash"],["⊣","\\dashv"],["⊩","\\Vdash"],["⊪","\\Vvdash"],["⊧","\\Dashv"],["≛","\\stargeq"],["≞","\\overset{!}{=}","Must equal"],["≝","\\overset{\\text{def}}{=}","Defined as"],["≟","\\overset{?}{=}","Questioned equality"],["≮","\\nless"],["≯","\\ngtr"],["≰","\\nleq"],["≱","\\ngeq"],["⊀","\\nprec"],["⊁","\\nsucc"],["⋖","\\lessdot"],["⋗","\\gtrdot"],["⋘","\\lll"],["⋙","\\ggg"],["∽","\\backsim"],["≎","\\Bumpeq"],["≏","\\bumpeq"],["≨","\\lneqq","Less but not equal"],["≩","\\gneqq","Greater but not equal"]]},{"id":"operators","structures":false,"items":[["+","+"],["−","-"],["×","\\times"],["÷","\\div"],["·","\\cdot"],["±","\\pm"],["∓","\\mp"],["∗","\\ast"],["⋆","\\star"],["∘","\\circ"],["∙","\\bullet"],["∂","\\partial"],["∇","\\nabla"],["′","^{\\prime}"],["″","^{\\prime\\prime}"],["‴","^{\\prime\\prime\\prime}"],["∩","\\cap"],["∪","\\cup"],["∖","\\setminus"],["⧵","\\smallsetminus"],["⊎","\\uplus"],["⊓","\\sqcap"],["⊔","\\sqcup"],["⋒","\\Cap"],["⋓","\\Cup"],["∧","\\wedge"],["∨","\\vee"],["⊼","\\barwedge"],["⊻","\\veebar"],["⋏","\\curlywedge"],["⋎","\\curlyvee"],["⊕","\\oplus"],["⊖","\\ominus"],["⊗","\\otimes"],["⊘","\\oslash"],["⊙","\\odot"],["⊝","\\circleddash"],["⊚","\\circledcirc"],["⊛","\\circledast"],["⊞","\\boxplus"],["⊟","\\boxminus"],["⊠","\\boxtimes"],["⊡","\\boxdot"],["⋉","\\ltimes"],["⋊","\\rtimes"],["⋋","\\leftthreetimes"],["⋌","\\rightthreetimes"],["⊺","\\intercal"],["∔","\\dotplus"],["⨿","\\amalg"],["≀","\\wr"],["⋄","\\diamond"],["◊","\\lozenge"],["△","\\triangle"],["▽","\\triangledown"],["▷","\\triangleright"],["◁","\\triangleleft"],["◀","\\blacktriangleleft"],["▶","\\blacktriangleright"],["†","\\dagger"],["‡","\\ddagger"],["⨁","\\bigoplus"],["⨂","\\bigotimes"],["⨀","\\bigodot"]]},{"id":"bigops","structures":false,"items":[["Σ","\\sum"],["Π","\\prod"],["∏","\\coprod"],["∫","\\int"],["∬","\\iint"],["∭","\\iiint"],["⨌","\\iiiint"],["∮","\\oint"],["∯","\\oiint"],["∰","\\oiiint"],["∫","\\smallint"],["⋃","\\bigcup"],["⋂","\\bigcap"],["⋁","\\bigvee"],["⋀","\\bigwedge"],["⨁","\\bigoplus"],["⨂","\\bigotimes"],["⨀","\\bigodot"],["⨄","\\biguplus"],["⨆","\\bigsqcup"]]},{"id":"arrows","structures":false,"items":[["→","\\rightarrow"],["←","\\leftarrow"],["⇒","\\Rightarrow"],["⇐","\\Leftarrow"],["↔","\\leftrightarrow"],["⇔","\\Leftrightarrow"],["↑","\\uparrow"],["↓","\\downarrow"],["↦","\\mapsto"],["⟼","\\longmapsto"],["⟶","\\longrightarrow"],["⟵","\\longleftarrow"],["⟷","\\longleftrightarrow"],["→ᵃ","\\xrightarrow{#?}","Labeled right arrow"],["⟹","\\Longrightarrow"],["⟸","\\Longleftarrow"],["⟺","\\Longleftrightarrow"],["↗","\\nearrow"],["↘","\\searrow"],["↙","\\swarrow"],["↖","\\nwarrow"],["⇗","\\Nearrow"],["⇘","\\Searrow"],["⇙","\\Swarrow"],["⇖","\\Nwarrow"],["↪","\\hookrightarrow"],["↩","\\hookleftarrow"],["↠","\\twoheadrightarrow"],["↣","\\rightarrowtail"],["⇄","\\rightleftarrows"],["⇆","\\leftrightarrows"],["⇉","\\rightrightarrows"],["⇇","\\leftleftarrows"],["⇌","\\rightleftharpoons"],["⇋","\\leftrightharpoons"],["↝","\\leadsto"],["⇝","\\rightsquigarrow"],["⇢","\\dashrightarrow"],["⇠","\\dashleftarrow"],["↺","\\circlearrowleft"],["↻","\\circlearrowright"],["↶","\\curvearrowleft"],["↷","\\curvearrowright"],["⇀","\\rightharpoonup"],["⇁","\\rightharpoondown"],["↾","\\upharpoonright"],["↿","\\upharpoonleft"],["⇃","\\downharpoonright"],["⇂","\\downharpoonleft"],["↤","\\mapsfrom"],["⟻","\\longmapsfrom"],["↫","\\looparrowleft"],["↬","\\looparrowright"],["↚","\\nleftarrow"],["↛","\\nrightarrow"],["⇍","\\nLeftarrow"],["⇏","\\nRightarrow"],["↮","\\nleftrightarrow"],["↕","\\updownarrow"],["⇕","\\Updownarrow"],["⟰","\\Uparrow"],["⟱","\\Downarrow"],["⇚","\\Lleftarrow"],["⇛","\\Rrightarrow"],["↞","\\twoheadleftarrow"],["↰","\\Lsh"],["↱","\\Rsh"],["↭","\\leftrightsquigarrow"]]},{"id":"sets","structures":false,"items":[["∈","\\in"],["∉","\\notin"],["∋","\\ni"],["∌","\\notni"],["∅","\\emptyset"],["∅","\\varnothing"],["∀","\\forall"],["∃","\\exists"],["∄","\\nexists"],["¬","\\neg"],["∧","\\land"],["∨","\\lor"],["⟹","\\implies"],["⟺","\\iff"],["∴","\\therefore"],["∵","\\because"],["∁","\\complement"],["𝒫(A)","\\mathcal{P}(#?)","Power set"],["{x∈A|P}","\\left\\{#?\\in#?\\mid#?\\right\\}","Set-builder notation"],["A×B","#?\\times#?","Cartesian product"],["Aᶜ","#?^{c}","Complement"],["𝟙_A","\\mathbf{1}_{#?}","Indicator function"],["△","#? \\triangle #?","Symmetric difference"],["|A|","|#?|","Cardinality"],["ℝ","\\mathbb{R}"],["ℕ","\\mathbb{N}"],["ℤ","\\mathbb{Z}"],["ℚ","\\mathbb{Q}"],["ℂ","\\mathbb{C}"],["ℙ","\\mathbb{P}"],["ℍ","\\mathbb{H}"],["{Aᵢ}","\\{#?\\}_{#?\\in #?}","Family of sets"],["limsup Aₙ","\\limsup_{n\\to\\infty} #?","Set limsup"],["liminf Aₙ","\\liminf_{n\\to\\infty} #?","Set liminf"],["|A∪B|","|A\\cup B| = |A|+|B|-|A\\cap B|","Inclusion-exclusion"],["𝔠","\\mathfrak{c} = 2^{\\aleph_0}","Continuum"],["⊤","\\top"],["⊥","\\bot"],["⋐","\\Subset","Double subset"],["⋑","\\Supset","Double superset"]]},{"id":"functions","structures":true,"items":[{"section":"初等函数","sectionEn":"Elementary Functions"},["sin","\\sin"],["cos","\\cos"],["tan","\\tan"],["log","\\log"],["ln","\\ln"],["lg","\\lg"],["exp","\\exp"],["sin⁻¹","\\sin^{-1}"],["cos⁻¹","\\cos^{-1}"],["tan⁻¹","\\tan^{-1}"],["sec","\\sec"],["csc","\\csc"],["cot","\\cot"],["arcsin","\\arcsin"],["arccos","\\arccos"],["arctan","\\arctan"],["sinh","\\sinh"],["cosh","\\cosh"],["tanh","\\tanh"],["coth","\\coth"],["sech","\\operatorname{sech}"],["csch","\\operatorname{csch}"],["arsinh","\\operatorname{arsinh}"],["arcosh","\\operatorname{arcosh}"],["artanh","\\operatorname{artanh}"],["√x","\\sqrt{#?}","Square root"],["xⁿ","#?^{#?}","Power function"],["|x|","\\left|#?\\right|","Absolute value"],["⌊x⌋","\\lfloor #? \\rfloor","Floor"],["⌈x⌉","\\lceil #? \\rceil","Ceiling"],{"section":"极限 / 优化 / 代数算子","sectionEn":"Limits / Optimization / Algebraic Operators"},["lim","\\lim"],["max","\\max"],["min","\\min"],["sup","\\sup"],["inf","\\inf"],["argmax","\\arg\\max"],["argmin","\\arg\\min"],["det","\\det"],["dim","\\dim"],["gcd","\\gcd"],["lcm","\\operatorname{lcm}"],["arg","\\arg"],["deg","\\deg"],["ker","\\ker"],["hom","\\hom"],["Pr","\\Pr"],["sgn","\\operatorname{sgn}"],["mod","\\bmod"],["pmod","\\pmod{#?}"],["Re","\\operatorname{Re}(#?)","Real part"],["Im","\\operatorname{Im}(#?)","Imaginary part"],["cis","\\operatorname{cis}(#?)","cis"],["sinc","\\operatorname{sinc}(#?)","Sinc"],["rank","\\operatorname{rank}"],["span","\\operatorname{span}"],["tr","\\operatorname{tr}"],["Spec","\\operatorname{Spec}(#?)","Spectrum"],["supp","\\operatorname{supp}(#?)","Support"],["ess sup","\\operatorname*{ess\\,sup} #?","Essential supremum"],["prox","\\operatorname{prox}_{#?}(#?)","Proximal map"],["conv","\\operatorname{conv}(#?)","Convex hull"],["cl","\\operatorname{cl}(#?)","Closure"],["int","\\operatorname{int}(#?)","Interior"],{"section":"Gamma / Beta / Zeta / 数论函数","sectionEn":"Gamma / Beta / Zeta / Number-Theoretic Functions"},["Γ","\\Gamma(z)=\\int_0^\\infty t^{z-1}e^{-t}\\,dt","Gamma function"],["γ","\\gamma(s,x)=\\int_0^x t^{s-1}e^{-t}\\,dt","Lower incomplete gamma"],["Γ(s,x)","\\Gamma(s,x)=\\int_x^\\infty t^{s-1}e^{-t}\\,dt","Upper incomplete gamma"],["B","B(x,y)=\\int_0^1 t^{x-1}(1-t)^{y-1}\\,dt=\\frac{\\Gamma(x)\\Gamma(y)}{\\Gamma(x+y)}","Beta function"],["ζ","\\zeta(s)=\\sum_{n=1}^\\infty n^{-s}=\\prod_p(1-p^{-s})^{-1}","Riemann zeta"],["η","\\eta(s)=\\sum_{n=1}^\\infty\\frac{(-1)^{n-1}}{n^s}=(1-2^{1-s})\\zeta(s)","Dirichlet eta"],["L","L(s,\\chi)=\\sum_{n=1}^\\infty\\frac{\\chi(n)}{n^s}=\\prod_p(1-\\chi(p)p^{-s})^{-1}","L-function"],["Λ","\\Lambda(n)=\\begin{cases}\\log p,&n=p^k\\\\0,&\\text{otherwise}\\end{cases}","Von Mangoldt"],["μ","\\mu(n)=\\begin{cases}1,&n=1\\\\(-1)^k,&n=p_1\\cdots p_k\\\\0,&p^2\\mid n\\end{cases}","Mobius function"],["φ","\\varphi(n)=n\\prod_{p\\mid n}\\left(1-\\frac1p\\right)","Euler totient"],["τ","\\tau(n)=\\sum_{d\\mid n}1","Divisor count"],["σₖ","\\sigma_k(n)=\\sum_{d\\mid n}d^k","Divisor sum"],["Liₛ","\\operatorname{Li}_s(z)=\\sum_{n=1}^\\infty\\frac{z^n}{n^s}","Polylogarithm"],["Li","\\operatorname{li}(x)=\\int_0^x\\frac{dt}{\\log t}","Logarithmic integral"],{"section":"误差 / 积分 / 椭圆函数","sectionEn":"Error / Integral / Elliptic Functions"},["erf","\\operatorname{erf}(x)=\\frac2{\\sqrt\\pi}\\int_0^x e^{-t^2}\\,dt","Error function"],["erfc","\\operatorname{erfc}(x)=1-\\operatorname{erf}(x)=\\frac2{\\sqrt\\pi}\\int_x^\\infty e^{-t^2}\\,dt","Complementary error function"],["erfi","\\operatorname{erfi}(x)=\\frac2{\\sqrt\\pi}\\int_0^x e^{t^2}\\,dt","Imaginary error function"],["Si","\\operatorname{Si}(x)=\\int_0^x\\frac{\\sin t}{t}\\,dt","Sine integral"],["Ci","\\operatorname{Ci}(x)=-\\int_x^\\infty\\frac{\\cos t}{t}\\,dt","Cosine integral"],["Ei","\\operatorname{Ei}(x)=\\operatorname{PV}\\int_{-\\infty}^x\\frac{e^t}{t}\\,dt","Exponential integral"],["Eₙ","E_n(x)=\\int_1^\\infty\\frac{e^{-xt}}{t^n}\\,dt","Exponential integral En"],["F(φ,k)","F(\\phi,k)=\\int_0^\\phi\\frac{d\\theta}{\\sqrt{1-k^2\\sin^2\\theta}}","Incomplete elliptic integral"],["K(k)","K(k)=\\int_0^{\\pi/2}\\frac{d\\theta}{\\sqrt{1-k^2\\sin^2\\theta}}","Complete elliptic integral"],["E(k)","E(k)=\\int_0^{\\pi/2}\\sqrt{1-k^2\\sin^2\\theta}\\,d\\theta","Elliptic integral E"],["Π(n,k)","\\Pi(n,k)=\\int_0^{\\pi/2}\\frac{d\\theta}{(1-n\\sin^2\\theta)\\sqrt{1-k^2\\sin^2\\theta}}","Elliptic integral Pi"],["sn","u=\\int_0^{\\operatorname{sn}(u,k)}\\frac{dt}{\\sqrt{(1-t^2)(1-k^2t^2)}}","Jacobi sn"],["cn","\\operatorname{cn}^2(u,k)+\\operatorname{sn}^2(u,k)=1","Jacobi cn"],["dn","\\operatorname{dn}^2(u,k)+k^2\\operatorname{sn}^2(u,k)=1","Jacobi dn"],["℘","\\wp(z;\\Lambda)=\\frac1{z^2}+\\sum_{\\omega\\in\\Lambda\\setminus\\{0\\}}\\left(\\frac1{(z-omega)^2}-\\frac1{\\omega^2}\\right)","Weierstrass elliptic function"],{"section":"Bessel / Airy / 正交多项式","sectionEn":"Bessel / Airy / Orthogonal Polynomials"},["Jν","J_\\nu(x)=\\sum_{m=0}^\\infty\\frac{(-1)^m}{m!\\Gamma(m+\\nu+1)}\\left(\\frac{x}{2}\\right)^{2m+\\nu}","Bessel J"],["Yν","Y_\\nu(x)=\\frac{J_\\nu(x)\\cos\\nu\\pi-J_{-\\nu}(x)}{\\sin\\nu\\pi}","Bessel Y"],["Iν","I_\\nu(x)=\\sum_{m=0}^\\infty\\frac1{m!\\Gamma(m+\\nu+1)}\\left(\\frac{x}{2}\\right)^{2m+\\nu}","Modified Bessel I"],["Kν","K_\\nu(x)=\\frac\\pi2\\frac{I_{-\\nu}(x)-I_\\nu(x)}{\\sin\\nu\\pi}","Modified Bessel K"],["Hν¹","H_\\nu^{(1)}(x)=J_\\nu(x)+iY_\\nu(x)","Hankel function first kind"],["Hν²","H_\\nu^{(2)}(x)=J_\\nu(x)-iY_\\nu(x)","Hankel function second kind"],["Ai","\\operatorname{Ai}''(x)-x\\operatorname{Ai}(x)=0","Airy Ai"],["Bi","\\operatorname{Bi}''(x)-x\\operatorname{Bi}(x)=0","Airy Bi"],["Pₙ","P_n(x)=\\frac1{2^nn!}\\frac{d^n}{dx^n}(x^2-1)^n","Legendre polynomial"],["Yₗᵐ","Y_l^m(\\theta,\\phi)=N_{lm}P_l^m(\\cos\\theta)e^{im\\phi}","Spherical harmonic"],["Lₙᵅ","L_n^{(\\alpha)}(x)=\\frac{x^{-\\alpha}e^x}{n!}\\frac{d^n}{dx^n}(e^{-x}x^{n+\\alpha})","Laguerre polynomial"],["Hₙ","H_n(x)=(-1)^ne^{x^2}\\frac{d^n}{dx^n}e^{-x^2}","Hermite polynomial"],["Tₙ","T_n(x)=\\cos(n\\arccos x)","Chebyshev T"],["Uₙ","U_n(x)=\\frac{\\sin((n+1)\\arccos x)}{\\sqrt{1-x^2}}","Chebyshev U"],{"section":"超几何 / q-函数 / 模函数","sectionEn":"Hypergeometric / q-Functions / Modular Functions"},["₂F₁","{}_2F_1(a,b;c;z)=\\sum_{n=0}^\\infty\\frac{(a)_n(b)_n}{(c)_n}\\frac{z^n}{n!}","Gauss hypergeometric"],["₁F₁","{}_1F_1(a;c;z)=\\sum_{n=0}^\\infty\\frac{(a)_n}{(c)_n}\\frac{z^n}{n!}","Confluent hypergeometric"],["₀F₁","{}_0F_1(;c;z)=\\sum_{n=0}^\\infty\\frac{z^n}{(c)_nn!}","Hypergeometric 0F1"],["pFq","{}_pF_q(a;b;z)=\\sum_{n=0}^\\infty\\frac{(a_1)_n\\cdots(a_p)_n}{(b_1)_n\\cdots(b_q)_n}\\frac{z^n}{n!}","Generalized hypergeometric"],["U(a,b,z)","U(a,b,z)=\\frac1{\\Gamma(a)}\\int_0^\\infty e^{-zt}t^{a-1}(1+t)^{b-a-1}\\,dt","Tricomi function"],["M(a,b,z)","M(a,b,z)={}_1F_1(a;b;z)","Kummer function"],["θ₁","\\vartheta_1(z,q)=2\\sum_{n=0}^\\infty(-1)^nq^{(n+1/2)^2}\\sin((2n+1)z)","Jacobi theta 1"],["θ₂","\\vartheta_2(z,q)=2\\sum_{n=0}^\\infty q^{(n+1/2)^2}\\cos((2n+1)z)","Jacobi theta 2"],["θ₃","\\vartheta_3(z,q)=1+2\\sum_{n=1}^\\infty q^{n^2}\\cos(2nz)","Jacobi theta 3"],["θ₄","\\vartheta_4(z,q)=1+2\\sum_{n=1}^\\infty(-1)^nq^{n^2}\\cos(2nz)","Jacobi theta 4"],["η(τ)","\\eta(\\tau)=q^{1/24}\\prod_{n=1}^\\infty(1-q^n),\\quad q=e^{2\\pi i\\tau}","Dedekind eta"],["j(τ)","j(\\tau)=\\frac{E_4(\\tau)^3}{\\Delta(\\tau)}","Modular j-invariant"],["q-Poch","(a;q)_n=\\prod_{k=0}^{n-1}(1-aq^k)","q-Pochhammer"],{"section":"阶跃 / 分布 / 病态函数","sectionEn":"Step / Distributions / Pathological Functions"},["H","H(x)=\\begin{cases}0,&x<0\\\\1,&x\\ge0\\end{cases}","Heaviside step function"],["δ","\\int_{-\\infty}^{\\infty}f(x)\\delta(x-a)\\,dx=f(a)","Dirac delta"],["χ_A","\\chi_A(x)=\\begin{cases}1,&x\\in A\\\\0,&x\\notin A\\end{cases}","Characteristic function"],["𝟙_A","\\mathbf{1}_A(x)=\\begin{cases}1,&x\\in A\\\\0,&x\\notin A\\end{cases}","Indicator function"],["sgn","\\operatorname{sgn}(x)=\\begin{cases}-1,&x<0\\\\0,&x=0\\\\1,&x>0\\end{cases}","Sign function"],["frac","\\operatorname{frac}(x)=x-\\lfloor x\\rfloor","Fractional part"],["W(x)","W(x)=\\sum_{n=0}^{\\infty}a^n\\cos(b^n\\pi x),\\quad 0<a<1,\\;ab>1+\\frac{3\\pi}{2}","Weierstrass function"],["R(x)","R(x)=\\sum_{n=1}^{\\infty}\\frac{\\sin(\\pi n^2x)}{n^2}","Riemann function"],["D(x)","D(x)=\\begin{cases}1,&x\\in\\mathbb Q\\\\0,&x\\notin\\mathbb Q\\end{cases}","Dirichlet function"],["C(x)","C(x)=\\sum_{n=1}^{\\infty}\\frac{2a_n}{3^n}\\quad(x=0.a_1a_2\\ldots\\text{ in base }3)","Cantor function"],["T(x)","T(x)=\\sum_{n=0}^{\\infty}\\frac{\\operatorname{dist}(2^nx,\\mathbb Z)}{2^n}","Takagi function"],["Th(x)","\\operatorname{Th}(x)=\\begin{cases}1/q,&x=p/q\\in\\mathbb Q,\\;(p,q)=1\\\\0,&x\\notin\\mathbb Q\\end{cases}","Thomae function"]]},{"id":"probability","structures":true,"items":[{"section":"概率空间 / 条件概率","sectionEn":"Probability Spaces / Conditional Probability"},["概率","\\mathbb{P}(A) = \\int_A f(x)dx","Probability"],["样本空间","\\Omega=\\{\\omega\\}","Sample space"],["事件域","\\mathcal F\\subset 2^\\Omega","Event sigma-algebra"],["概率空间","(\\Omega,\\mathcal F,\\mathbb P)","Probability space"],["补事件","\\mathbb P(A^c)=1-\\mathbb P(A)","Complement rule"],["加法公式","\\mathbb P(A\\cup B)=\\mathbb P(A)+\\mathbb P(B)-\\mathbb P(A\\cap B)","Addition rule"],["容斥原理","\\mathbb P\\left(\\bigcup_i A_i\\right)=\\sum_i\\mathbb P(A_i)-\\sum_{i<j}\\mathbb P(A_i\\cap A_j)+\\cdots","Inclusion-exclusion"],["Boole 不等式","\\mathbb P\\left(\\bigcup_i A_i\\right)\\le\\sum_i\\mathbb P(A_i)","Union bound"],["条件概率","\\mathbb P(A\\mid B)=\\frac{\\mathbb P(A\\cap B)}{\\mathbb P(B)}","Conditional probability"],["乘法公式","\\mathbb P(A\\cap B)=\\mathbb P(A\\mid B)\\mathbb P(B)","Multiplication rule"],["全概率","\\mathbb P(A)=\\sum_i\\mathbb P(A\\mid B_i)\\mathbb P(B_i)","Law of total probability"],["链式法则","\\mathbb P(A_1\\cap\\cdots\\cap A_n)=\\prod_{k=1}^n\\mathbb P(A_k\\mid A_1\\cap\\cdots\\cap A_{k-1})","Probability chain rule"],["条件独立","X\\perp\\!\\!\\!\\perp Y\\mid Z","Conditional independence"],["Borel-Cantelli I","\\sum_n\\mathbb P(A_n)<\\infty\\implies\\mathbb P(A_n\\;\\mathrm{i.o.})=0","Borel-Cantelli lemma I"],["Borel-Cantelli II","A_n\\text{ independent},\\;\\sum_n\\mathbb P(A_n)=\\infty\\implies\\mathbb P(A_n\\;\\mathrm{i.o.})=1","Borel-Cantelli lemma II"],["Radon-Nikodym","P\\ll Q\\implies \\frac{dP}{dQ}","Radon-Nikodym derivative"],{"section":"随机变量 / 分布 / 矩","sectionEn":"Random Variables / Distributions / Moments"},["期望","\\mathbb{E}[X] = \\int x\\,dF_X(x)","Expectation"],["方差","\\operatorname{Var}(X) = \\mathbb{E}[(X-\\mu)^2]","Variance"],["标准差","\\sigma_X = \\sqrt{\\operatorname{Var}(X)}","Standard deviation"],["协方差","\\operatorname{Cov}(X,Y) = \\mathbb{E}[(X-\\mu_X)(Y-\\mu_Y)]","Covariance"],["相关系数","\\rho_{XY} = \\frac{\\operatorname{Cov}(X,Y)}{\\sigma_X\\sigma_Y}","Correlation"],["协方差矩阵","\\Sigma_{ij} = \\operatorname{Cov}(X_i,X_j)","Covariance matrix"],["条件期望","\\mathbb{E}[X\\mid Y=y] = \\int x f_{X\\mid Y}(x\\mid y)dx","Conditional expectation"],["条件方差","\\operatorname{Var}(X\\mid Y) = \\mathbb{E}[(X-\\mathbb{E}[X\\mid Y])^2\\mid Y]","Conditional variance"],["矩","\\mathbb{E}[X^k] = \\int x^k dF_X(x)","Moment"],["中心矩","\\mu_k = \\mathbb{E}[(X-\\mu)^k]","Central moment"],["全期望公式","\\mathbb E[X]=\\mathbb E\\big[\\mathbb E[X\\mid\\mathcal G]\\big]","Tower property"],["全方差公式","\\operatorname{Var}(X)=\\mathbb E[\\operatorname{Var}(X\\mid Y)]+\\operatorname{Var}(\\mathbb E[X\\mid Y])","Law of total variance"],["CDF","F_X(x)=\\mathbb P(X\\le x)","Cumulative distribution function"],["PDF","f_X(x)=\\frac{d}{dx}F_X(x)","Probability density function"],["PMF","p_X(k)=\\mathbb P(X=k)","Probability mass function"],["分位数","Q(p)=F^{-1}(p)","Quantile function"],["生存函数","S(t)=1-F(t)","Survival function"],["分布收敛","X_n\\xrightarrow{d}X","Convergence in distribution"],["概率收敛","X_n\\xrightarrow{p}X","Convergence in probability"],["几乎处处收敛","X_n\\xrightarrow{a.s.}X","Almost sure convergence"],["Lp 收敛","\\|X_n-X\\|_p\\to0","Lp convergence"],{"section":"常见离散分布","sectionEn":"Common Discrete Distributions"},["退化分布","\\mathbb P(X=c)=1","Degenerate distribution"],["正态","f(x)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}","Normal distribution"],["伯努利","\\mathbb{P}(X=k)=p^k(1-p)^{1-k}","Bernoulli distribution"],["二项","\\mathbb{P}(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}","Binomial distribution"],["负二项","\\mathbb P(X=k)=\\binom{k+r-1}{k}(1-p)^k p^r","Negative binomial distribution"],["泊松","\\mathbb{P}(X=k)=\\frac{\\lambda^k e^{-\\lambda}}{k!}","Poisson distribution"],["几何","\\mathbb{P}(X=k)=(1-p)^{k-1}p","Geometric distribution"],["多项","\\mathbb{P}(X_i=n_i)=\\frac{n!}{\\prod n_i!}\\prod p_i^{n_i}","Multinomial distribution"],["超几何","\\mathbb{P}(X=k)=\\frac{\\binom{K}{k}\\binom{N-K}{n-k}}{\\binom{N}{n}}","Hypergeometric"],["Skellam","\\mathbb P(X=k)=e^{-(\\mu_1+\\mu_2)}\\left(\\frac{\\mu_1}{\\mu_2}\\right)^{k/2}I_{|k|}(2\\sqrt{\\mu_1\\mu_2})","Skellam distribution"],["离散均匀","\\mathbb P(X=k)=\\frac1n","Discrete uniform distribution"],{"section":"常见连续分布","sectionEn":"Common Continuous Distributions"},["均匀","f(x)=\\frac{1}{b-a},\\;a\\le x\\le b","Uniform distribution"],["指数","f(x)=\\lambda e^{-\\lambda x},\\;x\\ge0","Exponential distribution"],["对数正态","f(x)=\\frac{1}{x\\sigma\\sqrt{2\\pi}}e^{-\\frac{(\\ln x-\\mu)^2}{2\\sigma^2}}","Log-normal distribution"],["伽马","f(x)=\\frac{\\beta^\\alpha}{\\Gamma(\\alpha)}x^{\\alpha-1}e^{-\\beta x}","Gamma distribution"],["贝塔","f(x)=\\frac{x^{\\alpha-1}(1-x)^{\\beta-1}}{\\mathrm{B}(\\alpha,\\beta)}","Beta distribution"],["卡方","f(x)=\\frac{x^{k/2-1}e^{-x/2}}{2^{k/2}\\Gamma(k/2)}","Chi-squared"],["t 分布","f(t)=\\frac{\\Gamma(\\frac{\\nu+1}{2})}{\\sqrt{\\nu\\pi}\\Gamma(\\frac{\\nu}{2})}\\left(1+\\frac{t^2}{\\nu}\\right)^{-\\frac{\\nu+1}{2}}","Student t"],["F 分布","f(x)=\\frac{\\Gamma(\\frac{d_1+d_2}{2})}{\\Gamma(\\frac{d_1}{2})\\Gamma(\\frac{d_2}{2})}\\left(\\frac{d_1}{d_2}\\right)^{\\frac{d_1}{2}}x^{\\frac{d_1}{2}-1}\\left(1+\\frac{d_1}{d_2}x\\right)^{-\\frac{d_1+d_2}{2}}","F-distribution"],["Laplace","f(x)=\\frac1{2b}e^{-|x-\\mu|/b}","Laplace distribution"],["Pareto","f(x)=\\frac{\\alpha x_m^\\alpha}{x^{\\alpha+1}},\\;x\\ge x_m","Pareto distribution"],["Rayleigh","f(x)=\\frac{x}{\\sigma^2}e^{-x^2/(2\\sigma^2)}","Rayleigh distribution"],["Maxwell","f(v)=\\sqrt{\\frac2\\pi}\\frac{v^2}{a^3}e^{-v^2/(2a^2)}","Maxwell distribution"],["逆高斯","f(x)=\\left(\\frac{\\lambda}{2\\pi x^3}\\right)^{1/2}e^{-\\lambda(x-\\mu)^2/(2\\mu^2x)}","Inverse Gaussian distribution"],["条件","#? \\mid #?","Conditional bar"],["独立","#? \\perp\\!\\!\\!\\perp #?","Independence"],["贝叶斯","\\mathbb{P}(A|B) = \\frac{\\mathbb{P}(B|A)\\mathbb{P}(A)}{\\mathbb{P}(B)}","Bayes theorem"],["似然","\\mathcal{L}(\\theta;x) = f(x\\mid\\theta)","Likelihood"],{"section":"多元分布 / 变换","sectionEn":"Multivariate Distributions / Transformations"},["联合密度","f_{X,Y}(x,y)=f_{X\\mid Y}(x\\mid y)f_Y(y)","Joint density"],["边缘密度","f_X(x)=\\int f_{X,Y}(x,y)\\,dy","Marginal density"],["条件密度","f_{X\\mid Y}(x\\mid y)=\\frac{f_{X,Y}(x,y)}{f_Y(y)}","Conditional density"],["变量变换","f_Y(y)=f_X(g^{-1}(y))\\left|\\frac{d}{dy}g^{-1}(y)\\right|","Change of variables"],["Jacobian","f_{\\mathbf Y}(\\mathbf y)=f_{\\mathbf X}(g^{-1}(\\mathbf y))\\left|\\det Dg^{-1}(\\mathbf y)\\right|","Jacobian density transform"],["多元正态","f(x)=\\frac{1}{(2\\pi)^{d/2}|\\Sigma|^{1/2}}e^{-\\frac12(x-\\mu)^T\\Sigma^{-1}(x-\\mu)}","Multivariate normal"],["Wishart","S\\sim W_p(n,\\Sigma)","Wishart distribution"],["Copula","F(x_1,\\ldots,x_d)=C(F_1(x_1),\\ldots,F_d(x_d))","Copula"],{"section":"信息论 / 生成函数","sectionEn":"Information Theory / Generating Functions"},["信息熵","H(X) = -\\sum_{x} p(x)\\log p(x)","Entropy"],["条件熵","H(X\\mid Y)=H(X,Y)-H(Y)","Conditional entropy"],["交叉熵","H(P,Q)=-\\sum_xp(x)\\log q(x)","Cross entropy"],["KL 散度","D_{\\mathrm{KL}}(P\\|Q) = \\sum_x p(x)\\log\\frac{p(x)}{q(x)}","KL divergence"],["总变差距离","\\|P-Q\\|_{TV}=\\sup_A|P(A)-Q(A)|","Total variation distance"],["Hellinger","H^2(P,Q)=\\frac12\\int(\\sqrt p-\\sqrt q)^2","Hellinger distance"],["Fisher 信息","I(\\theta)=\\mathbb E\\left[\\left(\\frac{\\partial}{\\partial\\theta}\\log f(X;\\theta)\\right)^2\\right]","Fisher information"],["互信息","I(X;Y) = \\sum_{x,y} p(x,y)\\log\\frac{p(x,y)}{p(x)p(y)}","Mutual information"],["特征函数","\\varphi_X(t) = \\mathbb{E}[e^{itX}]","Characteristic function"],["生成函数","M_X(t) = \\mathbb{E}[e^{tX}]","Moment generating function"],["概率母函数","G_X(s)=\\mathbb E[s^X]","Probability generating function"],["累积量生成","K_X(t)=\\log M_X(t)","Cumulant generating function"],["累积量","\\kappa_n=K_X^{(n)}(0)","Cumulant"],{"section":"极限定理 / 不等式 / 大偏差","sectionEn":"Limit Theorems / Inequalities / Large Deviations"},["大数定律","\\bar{X}_n \\xrightarrow{p} \\mu","Law of large numbers"],["强大数律","\\bar X_n\\xrightarrow{a.s.}\\mathbb E[X]","Strong law of large numbers"],["中心极限","\\sqrt{n}(\\bar{X}_n-\\mu) \\xrightarrow{d} \\mathcal{N}(0,\\sigma^2)","Central limit theorem"],["马尔可夫","\\mathbb{P}(X\\ge a) \\le \\frac{\\mathbb{E}[X]}{a}","Markov inequality"],["切比雪夫","\\mathbb{P}(|X-\\mu|\\ge k\\sigma) \\le \\frac{1}{k^2}","Chebyshev inequality"],["Jensen","\\varphi(\\mathbb E X)\\le\\mathbb E\\varphi(X)","Jensen inequality"],["Hoeffding","\\mathbb P(\\bar X-\\mathbb E\\bar X\\ge t)\\le e^{-2nt^2/(b-a)^2}","Hoeffding inequality"],["Chernoff","\\mathbb P(X\\ge a)\\le\\inf_{t>0}e^{-ta}M_X(t)","Chernoff bound"],["Azuma-Hoeffding","\\mathbb P(M_n-M_0\\ge t)\\le e^{-t^2/(2\\sum c_i^2)}","Azuma-Hoeffding inequality"],["Slutsky","X_n\\Rightarrow X,\\;Y_n\\xrightarrow{p}c\\implies X_nY_n\\Rightarrow cX","Slutsky theorem"],["Delta 方法","\\sqrt n(g(\\hat\\theta)-g(\\theta))\\Rightarrow N(0,g'(\\theta)^2\\sigma^2)","Delta method"],["Glivenko-Cantelli","\\sup_x|F_n(x)-F(x)|\\xrightarrow{a.s.}0","Glivenko-Cantelli theorem"],["Donsker","\\sqrt n(F_n-F)\\Rightarrow\\mathbb B_F","Donsker theorem"],["Weibull","f(x)=\\frac{k}{\\lambda}\\left(\\frac{x}{\\lambda}\\right)^{k-1}e^{-(x/\\lambda)^k}","Weibull distribution"],["Dirichlet","f(\\mathbf{x};\\boldsymbol{\\alpha})=\\frac{1}{\\mathrm{B}(\\boldsymbol{\\alpha})}\\prod_{i=1}^k x_i^{\\alpha_i-1}","Dirichlet distribution"],["Cauchy","f(x)=\\frac{1}{\\pi\\gamma\\left(1+\\left(\\frac{x-x_0}{\\gamma}\\right)^2\\right)}","Cauchy distribution"],{"section":"数理统计 / 推断","sectionEn":"Mathematical Statistics / Inference"},["顺序统计量","X_{(k)}","Order statistic"],["顺序统计密度","f_{X_{(k)}}(x)=\\frac{n!}{(k-1)!(n-k)!}F(x)^{k-1}(1-F(x))^{n-k}f(x)","Order statistic density"],["经验分布","F_n(x) = \\frac1n\\sum_{i=1}^n \\mathbf{1}_{\\{X_i\\le x\\}}","Empirical CDF"],["置信区间","\\bar{X} \\pm z_{\\alpha/2}\\frac{\\sigma}{\\sqrt{n}}","Confidence interval"],["样本均值","\\bar X=\\frac1n\\sum_{i=1}^nX_i","Sample mean"],["样本方差","S^2=\\frac1{n-1}\\sum_{i=1}^n(X_i-\\bar X)^2","Sample variance"],["MLE","\\hat\\theta=\\arg\\max_\\theta L(\\theta;x)","Maximum likelihood estimator"],["得分函数","U(\\theta)=\\frac{\\partial}{\\partial\\theta}\\log L(\\theta)","Score function"],["Cramer-Rao","\\operatorname{Var}(\\hat\\theta)\\ge\\frac1{I(\\theta)}","Cramer-Rao lower bound"],["Wald 检验","W=\\frac{(\\hat\\theta-\\theta_0)^2}{\\widehat{\\operatorname{Var}}(\\hat\\theta)}","Wald test"],["似然比检验","\\Lambda=\\frac{\\sup_{\\theta\\in\\Theta_0}L(\\theta)}{\\sup_{\\theta\\in\\Theta}L(\\theta)}","Likelihood ratio test"],["p 值","p=\\mathbb P_{H_0}(T\\ge T_{obs})","p-value"],["贝叶斯后验","p(\\theta\\mid x)=\\frac{p(x\\mid\\theta)p(\\theta)}{p(x)}","Bayesian posterior"],["共轭先验","p(\\theta\\mid x)\\propto p(x\\mid\\theta)p(\\theta)","Conjugate prior"],["AIC","\\mathrm{AIC}=2k-2\\log L","Akaike information criterion"],["BIC","\\mathrm{BIC}=k\\log n-2\\log L","Bayesian information criterion"],["线性回归","\\hat\\beta=(X^TX)^{-1}X^Ty","Linear regression"],["Logistic 回归","\\mathbb P(Y=1\\mid x)=\\frac1{1+e^{-x^T\\beta}}","Logistic regression"],{"section":"可靠性 / 生存分析 / 极值","sectionEn":"Reliability / Survival Analysis / Extreme Values"},["风险率","h(t) = \\frac{f(t)}{1-F(t)}","Hazard rate"],["累积风险","H(t)=\\int_0^t h(s)\\,ds=-\\log S(t)","Cumulative hazard"],["Kaplan-Meier","\\hat S(t)=\\prod_{t_i\\le t}\\left(1-\\frac{d_i}{n_i}\\right)","Kaplan-Meier estimator"],["Cox 模型","h(t\\mid x)=h_0(t)e^{x^T\\beta}","Cox proportional hazards model"],["GEV","G(z)=\\exp\\left\\{-\\left[1+\\xi\\left(\\frac{z-\\mu}{\\sigma}\\right)\\right]^{-1/\\xi}\\right\\}","Generalized extreme value"],["GPD","G(y)=1-\\left(1+\\frac{\\xi y}{\\sigma}\\right)^{-1/\\xi}","Generalized Pareto distribution"],{"section":"随机过程 / 马尔可夫过程","sectionEn":"Stochastic Processes / Markov Processes"},["随机过程","\\{X_t\\}_{t\\in T}","Stochastic process"],["马尔可夫链","\\mathbb{P}(X_{n+1}=j\\mid X_n=i) = p_{ij}","Markov chain"],["转移矩阵","P^{(n)}=P^n","Transition matrix"],["Chapman-Kolmogorov","p_{ij}^{(m+n)}=\\sum_kp_{ik}^{(m)}p_{kj}^{(n)}","Chapman-Kolmogorov equation"],["平稳分布","\\pi P=\\pi","Stationary distribution"],["细致平衡","\\pi_i p_{ij}=\\pi_jp_{ji}","Detailed balance"],["生成矩阵","q_{ij}=\\lim_{h\\downarrow0}\\frac{p_{ij}(h)}h","Generator matrix"],["泊松过程","N_t \\sim \\operatorname{Pois}(\\lambda t)","Poisson process"],["指数等待时","T\\sim\\operatorname{Exp}(\\lambda)","Exponential waiting time"],["更新过程","N(t)=\\max\\{n:S_n\\le t\\}","Renewal process"],["更新方程","m(t)=F(t)+\\int_0^t m(t-x)\\,dF(x)","Renewal equation"],["分支过程","Z_{n+1}=\\sum_{i=1}^{Z_n}\\xi_{n,i}","Branching process"],["Galton-Watson","\\mathbb E[Z_n]=m^n","Galton-Watson process"],["排队 M/M/1","\\rho=\\frac\\lambda\\mu,\\quad L=\\frac{\\rho}{1-\\rho}","M/M/1 queue"],{"section":"鞅 / 布朗运动 / 随机分析","sectionEn":"Martingales / Brownian Motion / Stochastic Analysis"},["布朗运动","B_t \\sim \\mathcal{N}(0,t)","Brownian motion"],["鞅","\\mathbb{E}[X_{t+s}\\mid\\mathcal{F}_t] = X_t","Martingale"],["次鞅","\\mathbb E[X_t\\mid\\mathcal F_s]\\ge X_s","Submartingale"],["上鞅","\\mathbb E[X_t\\mid\\mathcal F_s]\\le X_s","Supermartingale"],["停时","\\tau = \\inf\\{t: X_t \\in A\\}","Stopping time"],["随机游走","S_n = X_1 + \\cdots + X_n","Random walk"],["反射原理","\\mathbb P(\\sup_{s\\le t}B_s\\ge a)=2\\mathbb P(B_t\\ge a)","Reflection principle"],["强马尔可夫性","\\mathbb P_x(X_{\\tau+t}\\in A\\mid\\mathcal F_\\tau)=\\mathbb P_{X_\\tau}(X_t\\in A)","Strong Markov property"],["Itô 积分","\\int_0^t X_s\\,dB_s","Ito integral"],["Itô 引理","df = \\left(\\frac{\\partial f}{\\partial t}+\\mu\\frac{\\partial f}{\\partial x}+\\frac12\\sigma^2\\frac{\\partial^2 f}{\\partial x^2}\\right)dt + \\sigma\\frac{\\partial f}{\\partial x}dB","Ito lemma"],["随机微分方程","dX_t = \\mu(X_t,t)dt + \\sigma(X_t,t)dB_t","SDE"],["Kolmogorov 方程","\\frac{\\partial p}{\\partial t} = -\\frac{\\partial}{\\partial x}(\\mu p) + \\frac12\\frac{\\partial^2}{\\partial x^2}(\\sigma^2 p)","Kolmogorov eqn"],["Feynman-Kac","u(x,t) = \\mathbb{E}\\left[e^{-\\int_t^T r\\,ds}\\varphi(X_T)\\mid X_t=x\\right]","Feynman-Kac"],["二次变分","[X,X]_t = \\lim_{|\\Pi|\\to0}\\sum_{i}(X_{t_i}-X_{t_{i-1}})^2","Quadratic variation"],["遍历定理","\\frac1T\\int_0^T X_t\\,dt \\xrightarrow{a.s.} \\mathbb{E}[X_0]","Ergodic theorem"],["Doob 停时","\\mathbb{E}[X_\\tau] = \\mathbb{E}[X_0]","Doob optional stopping"],["Doob 不等式","\\mathbb P\\left(\\sup_{k\\le n}|M_k|\\ge\\lambda\\right)\\le\\frac{\\mathbb E|M_n|^p}{\\lambda^p}","Doob maximal inequality"],["BDG 不等式","\\mathbb E\\sup_{t\\le T}|M_t|^p\\asymp\\mathbb E[M]_T^{p/2}","Burkholder-Davis-Gundy inequality"],["Girsanov","\\frac{d\\mathbb Q}{d\\mathbb P}\\bigg|_{\\mathcal F_t}=\\exp\\left(\\int_0^t\\theta_s\\,dB_s-\\frac12\\int_0^t\\theta_s^2ds\\right)","Girsanov theorem"],["OU 过程","dX_t=\\theta(\\mu-X_t)dt+\\sigma dB_t","Ornstein-Uhlenbeck process"],["几何布朗运动","dS_t=\\mu S_tdt+\\sigma S_tdB_t","Geometric Brownian motion"],{"section":"贝叶斯 / 机器学习概率","sectionEn":"Bayesian / Probabilistic Machine Learning"},["贝叶斯预测","p(x_*\\mid x)=\\int p(x_*\\mid\\theta)p(\\theta\\mid x)d\\theta","Posterior predictive"],["MAP","\\hat\\theta_{MAP}=\\arg\\max_\\theta p(\\theta\\mid x)","Maximum a posteriori"],["变分推断","\\mathrm{ELBO}=\\mathbb E_q[\\log p(x,z)]-\\mathbb E_q[\\log q(z)]","Variational inference"],["EM 算法","Q(\\theta\\mid\\theta^{old})=\\mathbb E_{Z\\mid X,\\theta^{old}}[\\log p(X,Z\\mid\\theta)]","EM algorithm"],["高斯过程","f\\sim\\mathcal{GP}(m,k)","Gaussian process"],["核协方差","k(x,x')=\\sigma^2\\exp\\left(-\\frac{\\|x-x'\\|^2}{2\\ell^2}\\right)","Squared exponential kernel"],["隐马尔可夫","p(x_{1:T},z_{1:T})=p(z_1)\\prod_t p(x_t\\mid z_t)\\prod_{t>1}p(z_t\\mid z_{t-1})","Hidden Markov model"],["Kalman 预测","x_t=Ax_{t-1}+w_t,\\quad y_t=Hx_t+v_t","Kalman state space model"],["大偏差","\\mathbb{P}(\\bar X_n > a) \\asymp e^{-nI(a)}","Large deviation"]]},{"id":"physics","structures":true,"items":[{"section":"经典力学 / 分析力学","sectionEn":"Classical / Analytical Mechanics"},["牛顿第二定律","\\mathbf{F} = m\\mathbf{a}","Newton 2nd"],["动能","E_k = \\frac{1}{2}mv^2","Kinetic energy"],["动量","\\mathbf{p} = m\\mathbf{v}","Momentum"],["角动量","\\mathbf{L} = \\mathbf{r}\\times\\mathbf{p}","Angular momentum"],["扭矩","\\boldsymbol{\\tau} = \\mathbf{r}\\times\\mathbf{F}","Torque"],["转动惯量","I = \\int r^2\\,dm","Moment of inertia"],["角速度","\\omega = \\frac{d\\theta}{dt}","Angular velocity"],["向心加速度","a_c = \\frac{v^2}{r}","Centripetal acceleration"],["功","W = \\int \\mathbf{F}\\cdot d\\mathbf{r}","Work"],["功率","P = \\frac{dW}{dt} = \\mathbf{F}\\cdot\\mathbf{v}","Power"],["冲量","\\mathbf J=\\int_{t_1}^{t_2}\\mathbf F\\,dt=\\Delta\\mathbf p","Impulse"],["动量守恒","\\sum_i \\mathbf p_i=\\mathrm{const}","Momentum conservation"],["质心","\\mathbf R=\\frac{1}{M}\\sum_i m_i\\mathbf r_i","Center of mass"],["约化质量","\\mu=\\frac{m_1m_2}{m_1+m_2}","Reduced mass"],["万有引力","F = G\\frac{m_1 m_2}{r^2}","Gravity"],["引力势能","U = -\\frac{GMm}{r}","Gravitational potential"],["逃逸速度","v_e=\\sqrt{\\frac{2GM}{r}}","Escape velocity"],["开普勒第三定律","\\frac{T^2}{a^3}=\\frac{4\\pi^2}{G(M+m)}","Kepler third law"],["胡克定律","F = -k x","Hooke law"],["弹簧势能","U = \\frac{1}{2}kx^2","Spring potential"],["简谐运动","x(t) = A\\cos(\\omega t + \\phi)","SHM"],["简谐周期","T = 2\\pi\\sqrt{\\frac{m}{k}}","SHM period"],["单摆周期","T = 2\\pi\\sqrt{\\frac{L}{g}}","Pendulum period"],["阻尼振子","m\\ddot x+b\\dot x+kx=0","Damped oscillator"],["受迫振子","m\\ddot x+b\\dot x+kx=F_0\\cos\\omega t","Driven oscillator"],["刚体转动能","T=\\frac12 I\\omega^2","Rotational kinetic energy"],["Euler 刚体方程","I_1\\dot\\omega_1=(I_2-I_3)\\omega_2\\omega_3","Euler rigid body equation"],["维里定理","2\\langle T\\rangle=\\left\\langle\\sum_i \\mathbf r_i\\cdot\\nabla_i V\\right\\rangle","Virial theorem"],["拉格朗日量","L = T - V","Lagrangian"],["欧拉-拉格朗日","\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot q_i}-\\frac{\\partial L}{\\partial q_i}=0","Euler-Lagrange"],["哈密顿量","H = \\sum_i p_i\\dot q_i - L","Hamiltonian"],["哈密顿方程","\\dot q_i=\\frac{\\partial H}{\\partial p_i},\\quad \\dot p_i=-\\frac{\\partial H}{\\partial q_i}","Hamilton equations"],["作用量","S = \\int L\\,dt","Action"],["最小作用量","\\delta S=0","Least action"],["泊松括号","\\{f,g\\}=\\sum_i\\left(\\frac{\\partial f}{\\partial q_i}\\frac{\\partial g}{\\partial p_i}-\\frac{\\partial f}{\\partial p_i}\\frac{\\partial g}{\\partial q_i}\\right)","Poisson bracket"],["哈密顿-雅可比","\\frac{\\partial S}{\\partial t}+H\\left(q_i,\\frac{\\partial S}{\\partial q_i},t\\right)=0","Hamilton-Jacobi"],["Liouville 定理","\\frac{d\\rho}{dt}=\\frac{\\partial\\rho}{\\partial t}+\\{\\rho,H\\}=0","Liouville theorem"],["诺特定理","\\partial_\\mu j^\\mu = 0","Noether theorem"],{"section":"连续介质 / 流体 / 声学","sectionEn":"Continuum / Fluids / Acoustics"},["连续性","\\frac{\\partial \\rho}{\\partial t}+\\nabla\\cdot(\\rho\\mathbf v)=0","Continuity equation"],["Euler 方程","\\rho\\left(\\frac{\\partial\\mathbf v}{\\partial t}+\\mathbf v\\cdot\\nabla\\mathbf v\\right)=-\\nabla p+\\rho\\mathbf f","Euler equation"],["Navier-Stokes","\\rho\\left(\\frac{\\partial\\mathbf v}{\\partial t}+\\mathbf v\\cdot\\nabla\\mathbf v\\right)=-\\nabla p+\\mu\\nabla^2\\mathbf v+\\rho\\mathbf f","Navier-Stokes"],["不可压缩","\\nabla\\cdot\\mathbf v=0","Incompressible flow"],["伯努利","p+\\frac12\\rho v^2+\\rho gh=\\text{const}","Bernoulli equation"],["雷诺数","\\mathrm{Re}=\\frac{\\rho vL}{\\mu}","Reynolds number"],["马赫数","\\mathrm{Ma}=\\frac{v}{c_s}","Mach number"],["泊肃叶定律","Q=\\frac{\\pi R^4}{8\\mu L}\\Delta p","Poiseuille law"],["Stokes 阻力","\\mathbf F_d=-6\\pi\\mu R\\mathbf v","Stokes drag"],["粘性剪应力","\\tau=\\mu\\frac{du}{dy}","Viscous shear stress"],["应力张量","\\sigma_{ij}=C_{ijkl}\\varepsilon_{kl}","Stress tensor"],["应变张量","\\varepsilon_{ij}=\\frac12(\\partial_i u_j+\\partial_j u_i)","Strain tensor"],["Hooke 张量","\\sigma_{ij}=\\lambda\\delta_{ij}\\varepsilon_{kk}+2\\mu\\varepsilon_{ij}","Isotropic elasticity"],["弦波速","v=\\sqrt{\\frac{T}{\\mu}}","String wave speed"],["波动方程","\\nabla^2 u-\\frac1{c^2}\\frac{\\partial^2u}{\\partial t^2}=0","Wave equation"],["多普勒","f' = f\\frac{c \\pm v_r}{c \\mp v_s}","Doppler effect"],["声强","I=\\frac{P}{A}=\\frac{p_{\\mathrm{rms}}^2}{\\rho c}","Sound intensity"],["分贝","\\beta=10\\log_{10}\\frac{I}{I_0}","Decibel level"],{"section":"电路 / 电磁学","sectionEn":"Circuits / Electromagnetism"},["欧姆定律","V = IR","Ohm law"],["功率电学","P = I^2 R = IV","Electric power"],["焦耳定律","P = I^2 R","Joule heating"],["电容","C = \\frac{Q}{V}","Capacitance"],["平行板电容","C=\\varepsilon\\frac{A}{d}","Parallel-plate capacitor"],["RC 充电","V(t) = V_0(1-e^{-t/RC})","RC charging"],["RC 放电","V(t) = V_0e^{-t/RC}","RC discharging"],["电感","\\mathcal{E} = -L\\frac{dI}{dt}","Inductance"],["RL 时间常数","\\tau=\\frac{L}{R}","RL time constant"],["RLC 谐振","\\omega_0=\\frac{1}{\\sqrt{LC}}","RLC resonance"],["基尔霍夫电流","\\sum_k I_k=0","Kirchhoff current law"],["基尔霍夫电压","\\sum_k V_k=0","Kirchhoff voltage law"],["库仑定律","F = k_e\\frac{q_1 q_2}{r^2}","Coulomb law"],["电场","\\mathbf{E} = \\frac{\\mathbf{F}}{q}","Electric field"],["电势","V = -\\int \\mathbf{E}\\cdot d\\mathbf{l}","Electric potential"],["电偶极矩","\\mathbf{p} = q\\mathbf{d}","Dipole moment"],["电位移","\\mathbf D=\\varepsilon_0\\mathbf E+\\mathbf P","Electric displacement"],["磁场强度","\\mathbf H=\\frac{1}{\\mu_0}\\mathbf B-\\mathbf M","Magnetic field strength"],["高斯定律","\\oint \\mathbf{E}\\cdot d\\mathbf{A} = \\frac{Q}{\\varepsilon_0}","Gauss law"],["法拉第定律","\\mathcal{E} = -\\frac{d\\Phi_B}{dt}","Faraday law"],["安培定律","\\oint \\mathbf{B}\\cdot d\\mathbf{l} = \\mu_0 I","Ampere law"],["毕奥-萨伐尔","d\\mathbf{B} = \\frac{\\mu_0}{4\\pi}\\frac{I\\,d\\mathbf{l}\\times\\hat{r}}{r^2}","Biot-Savart law"],["洛伦兹力","\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v}\\times\\mathbf{B})","Lorentz force"],["磁矢势","\\mathbf{B} = \\nabla\\times\\mathbf{A}","Magnetic vector potential"],["麦克斯韦","\\nabla\\cdot\\mathbf{E}=\\frac{\\rho}{\\varepsilon_0},\\; \\nabla\\cdot\\mathbf{B}=0,\\; \\nabla\\times\\mathbf{E}=-\\frac{\\partial\\mathbf{B}}{\\partial t},\\; \\nabla\\times\\mathbf{B}=\\mu_0\\mathbf{J}+\\mu_0\\varepsilon_0\\frac{\\partial\\mathbf{E}}{\\partial t}","Maxwell eqns"],["位移电流","\\mathbf J_D=\\varepsilon_0\\frac{\\partial\\mathbf E}{\\partial t}","Displacement current"],["电磁波","\\nabla^2\\mathbf E-\\mu_0\\varepsilon_0\\frac{\\partial^2\\mathbf E}{\\partial t^2}=0","EM wave equation"],["坡印廷矢量","\\mathbf S=\\frac1{\\mu_0}\\mathbf E\\times\\mathbf B","Poynting vector"],["电场能量密度","u_E=\\frac12\\varepsilon E^2","Electric energy density"],["磁场能量密度","u_B=\\frac{B^2}{2\\mu}","Magnetic energy density"],["规范变换","\\mathbf A\\mapsto\\mathbf A+\\nabla\\chi,\\quad \\phi\\mapsto\\phi-\\partial_t\\chi","Gauge transform"],["Lorenz 规范","\\partial_\\mu A^\\mu=0","Lorenz gauge"],{"section":"光学 / 波动","sectionEn":"Optics / Waves"},["折射定律","n_1\\sin\\theta_1 = n_2\\sin\\theta_2","Snell law"],["透镜方程","\\frac{1}{f} = \\frac{1}{u} + \\frac{1}{v}","Lens equation"],["放大率","M=-\\frac{v}{u}","Magnification"],["杨氏双缝","d\\sin\\theta = m\\lambda","Young double-slit"],["薄膜干涉","2nt\\cos\\theta=m\\lambda","Thin-film interference"],["单缝衍射","a\\sin\\theta=m\\lambda","Single-slit diffraction"],["光栅方程","d\\sin\\theta=m\\lambda","Diffraction grating"],["瑞利判据","\\theta = 1.22\\frac{\\lambda}{D}","Rayleigh criterion"],["相速度","v_p=\\frac{\\omega}{k}","Phase velocity"],["群速度","v_g=\\frac{d\\omega}{dk}","Group velocity"],["Fresnel 系数","r=\\frac{n_1-n_2}{n_1+n_2}","Fresnel coefficient"],["Malus 定律","I=I_0\\cos^2\\theta","Malus law"],["布儒斯特角","\\tan\\theta_B=\\frac{n_2}{n_1}","Brewster angle"],["高斯光束腰","w(z)=w_0\\sqrt{1+\\left(\\frac{z}{z_R}\\right)^2}","Gaussian beam waist"],["Bragg 衍射","2d\\sin\\theta=n\\lambda","Bragg law"],{"section":"热学 / 热力学 / 统计物理","sectionEn":"Thermal / Thermodynamics / Statistical Physics"},["理想气体","PV = nRT","Ideal gas law"],["热力学第一定律","\\Delta U = Q - W","1st law thermo"],["热力学第二定律","dS\\ge \\frac{\\delta Q}{T}","2nd law thermo"],["热力学第三定律","\\lim_{T\\to0}S=S_0","3rd law thermo"],["熵","dS = \\frac{dQ_{\\text{rev}}}{T}","Entropy"],["玻尔兹曼","S = k_B \\ln W","Boltzmann entropy"],["热容","Q = mc\\Delta T","Heat capacity"],["比热容","c=\\frac{Q}{m\\Delta T}","Specific heat capacity"],["摩尔热容","C_m=\\frac{Q}{n\\Delta T}","Molar heat capacity"],["定容热容","C_V=\\left(\\frac{\\partial U}{\\partial T}\\right)_V","Heat capacity at constant volume"],["定压热容","C_p=\\left(\\frac{\\partial H}{\\partial T}\\right)_p","Heat capacity at constant pressure"],["热容差","C_p-C_V=nR","Heat capacity difference"],["热容比","\\gamma=\\frac{C_p}{C_V}","Heat capacity ratio"],["潜热","Q = mL","Latent heat"],["热膨胀","\\Delta L=\\alpha L_0\\Delta T","Thermal expansion"],["绝热方程","PV^\\gamma=\\mathrm{const}","Adiabatic equation"],["等温功","W=nRT\\ln\\frac{V_2}{V_1}","Isothermal work"],["卡诺效率","\\eta_C = 1 - \\frac{T_c}{T_h}","Carnot efficiency"],["自由能","F = U - TS","Helmholtz free energy"],["吉布斯自由能","G = H - TS","Gibbs free energy"],["焓","H = U + PV","Enthalpy"],["化学势","\\mu=\\left(\\frac{\\partial G}{\\partial N}\\right)_{T,p}","Chemical potential"],["巨势","\\Omega=U-TS-\\mu N","Grand potential"],["Gibbs-Duhem","S\\,dT-V\\,dp+N\\,d\\mu=0","Gibbs-Duhem relation"],["Maxwell 关系","\\left(\\frac{\\partial T}{\\partial V}\\right)_S=-\\left(\\frac{\\partial p}{\\partial S}\\right)_V","Maxwell relation"],["热传导","\\frac{dQ}{dt} = -kA\\frac{dT}{dx}","Heat conduction"],["热扩散方程","\\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2T","Heat equation"],["斯特藩-玻尔兹曼","j = \\sigma T^4","Stefan-Boltzmann law"],["维恩位移","\\lambda_{\\max}T=b","Wien displacement law"],["普朗克谱","B_\\nu(T)=\\frac{2h\\nu^3}{c^2}\\frac{1}{e^{h\\nu/k_BT}-1}","Planck spectrum"],["配分函数","Z=\\sum_i e^{-\\beta E_i}","Partition function"],["Helmholtz 与 Z","F=-k_BT\\ln Z","Free energy partition function"],["内能与 Z","U=-\\frac{\\partial}{\\partial\\beta}\\ln Z","Internal energy from partition function"],["涨落热容","C_V=\\frac{\\langle E^2\\rangle-\\langle E\\rangle^2}{k_BT^2}","Heat capacity fluctuation"],["Boltzmann 分布","p_i=\\frac{e^{-\\beta E_i}}{Z}","Boltzmann distribution"],["Maxwell-Boltzmann","f(v)\\propto e^{-mv^2/(2k_BT)}","Maxwell-Boltzmann"],["费米-狄拉克","f(E) = \\frac{1}{e^{(E-\\mu)/kT}+1}","Fermi-Dirac"],["玻色-爱因斯坦","f(E) = \\frac{1}{e^{(E-\\mu)/kT}-1}","Bose-Einstein"],["涨落耗散","S_{xx}(\\omega)=\\frac{2k_BT}{\\omega}\\operatorname{Im}\\chi(\\omega)","Fluctuation-dissipation"],{"section":"量子力学 / 原子物理","sectionEn":"Quantum Mechanics / Atomic Physics"},["薛定谔方程","i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi","Schrodinger eqn"],["定态薛定谔","\\hat H\\psi_n=E_n\\psi_n","Time-independent Schrodinger"],["概率密度","\\rho(\\mathbf r,t)=|\\Psi(\\mathbf r,t)|^2","Probability density"],["概率流","\\mathbf j=\\frac{\\hbar}{2mi}(\\psi^*\\nabla\\psi-\\psi\\nabla\\psi^*)","Probability current"],["期望值","\\langle A\\rangle=\\langle\\psi|\\hat A|\\psi\\rangle","Expectation value"],["对易子","[\\hat A,\\hat B]=\\hat A\\hat B-\\hat B\\hat A","Commutator"],["不确定性","\\Delta x\\,\\Delta p \\geq \\frac{\\hbar}{2}","Uncertainty"],["Ehrenfest 定理","\\frac{d}{dt}\\langle\\hat A\\rangle=\\frac{i}{\\hbar}\\langle[\\hat H,\\hat A]\\rangle+\\left\\langle\\frac{\\partial\\hat A}{\\partial t}\\right\\rangle","Ehrenfest theorem"],["粒子盒能级","E_n=\\frac{n^2\\pi^2\\hbar^2}{2mL^2}","Particle in a box"],["谐振子能级","E_n=\\hbar\\omega\\left(n+\\frac12\\right)","Quantum harmonic oscillator"],["升降算符","[\\hat a,\\hat a^\\dagger]=1","Ladder operators"],["角动量代数","[L_i,L_j]=i\\hbar\\epsilon_{ijk}L_k","Angular momentum algebra"],["光电效应","E_{\\text{max}} = h\\nu - \\phi","Photoelectric"],["德布罗意","\\lambda = \\frac{h}{p}","de Broglie"],["黑体辐射","I(\\nu,T) = \\frac{2h\\nu^3}{c^2}\\frac{1}{e^{h\\nu/k_B T}-1}","Planck law"],["衰变定律","N(t) = N_0e^{-\\lambda t}","Decay law"],["半衰期","T_{1/2} = \\frac{\\ln 2}{\\lambda}","Half-life"],["Pauli 矩阵","\\sigma_1 = \\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}","Pauli matrix"],["自旋代数","[S_i,S_j]=i\\hbar\\epsilon_{ijk}S_k","Spin algebra"],["玻尔半径","a_0 = \\frac{4\\pi\\varepsilon_0\\hbar^2}{m_e e^2}","Bohr radius"],["里德伯公式","\\frac{1}{\\lambda} = R\\!\\left(\\frac{1}{n_1^2}-\\frac{1}{n_2^2}\\right)","Rydberg formula"],["玻尔模型","E_n = -\\frac{13.6\\,\\mathrm{eV}}{n^2}","Bohr model"],["Zeeman 能量","\\Delta E=m_j g_J\\mu_B B","Zeeman energy"],["隧穿概率","T\\approx e^{-2\\int_{x_1}^{x_2}\\sqrt{2m(V-E)}\\,dx/\\hbar}","Tunneling probability"],["康普顿","\\lambda' - \\lambda = \\frac{h}{mc}(1-\\cos\\theta)","Compton scattering"],{"section":"狭义相对论 / 广义相对论 / 宇宙学","sectionEn":"Special / General Relativity / Cosmology"},["质能方程","E = mc^2","Mass-energy"],["相对论动量","E^2 = (pc)^2 + (mc^2)^2","Energy-momentum"],["Lorentz 因子","\\gamma = \\frac{1}{\\sqrt{1-v^2/c^2}}","Lorentz factor"],["四维间隔","ds^2 = -c^2dt^2 + dx^2 + dy^2 + dz^2","Spacetime interval"],["四动量","p^\\mu=mu^\\mu","Four-momentum"],["Lorentz 变换","x'^\\mu=\\Lambda^\\mu{}_{\\nu}x^\\nu","Lorentz transform"],["时间膨胀","\\Delta t=\\gamma\\Delta t_0","Time dilation"],["长度收缩","L=\\frac{L_0}{\\gamma}","Length contraction"],["速度合成","u' = \\frac{u-v}{1-uv/c^2}","Relativistic velocity addition"],["固有时","d\\tau=dt\\sqrt{1-v^2/c^2}","Proper time"],["测地线方程","\\frac{d^2x^\\mu}{d\\tau^2}+\\Gamma^\\mu_{\\nu\\rho}\\frac{dx^\\nu}{d\\tau}\\frac{dx^\\rho}{d\\tau}=0","Geodesic equation"],["黎曼曲率","R^\\rho{}_{\\sigma\\mu\\nu}=\\partial_\\mu\\Gamma^\\rho_{\\nu\\sigma}-\\partial_\\nu\\Gamma^\\rho_{\\mu\\sigma}+\\Gamma^\\rho_{\\mu\\lambda}\\Gamma^\\lambda_{\\nu\\sigma}-\\Gamma^\\rho_{\\nu\\lambda}\\Gamma^\\lambda_{\\mu\\sigma}","Riemann curvature"],["Einstein 方程","G_{\\mu\\nu}+\\Lambda g_{\\mu\\nu}=\\frac{8\\pi G}{c^4}T_{\\mu\\nu}","Einstein field equation"],["Schwarzschild 半径","r_s=\\frac{2GM}{c^2}","Schwarzschild radius"],["Schwarzschild 度规","ds^2=-\\left(1-\\frac{r_s}{r}\\right)c^2dt^2+\\left(1-\\frac{r_s}{r}\\right)^{-1}dr^2+r^2d\\Omega^2","Schwarzschild metric"],["引力红移","\\frac{\\nu_\\infty}{\\nu_r}=\\sqrt{1-\\frac{2GM}{rc^2}}","Gravitational redshift"],["Friedmann 方程","H^2=\\left(\\frac{\\dot a}{a}\\right)^2=\\frac{8\\pi G}{3}\\rho-\\frac{kc^2}{a^2}+\\frac{\\Lambda c^2}{3}","Friedmann equation"],["加速度方程","\\frac{\\ddot a}{a}=-\\frac{4\\pi G}{3}\\left(\\rho+\\frac{3p}{c^2}\\right)+\\frac{\\Lambda c^2}{3}","Acceleration equation"],["哈勃定律","v=H_0d","Hubble law"],["红移","1+z=\\frac{a_0}{a}","Cosmological redshift"],{"section":"量子场论 / 粒子物理 / 规范理论","sectionEn":"QFT / Particle Physics / Gauge Theory"},["达朗贝尔","\\square = \\partial_\\mu\\partial^\\mu","d'Alembertian"],["Klein-Gordon","(\\square + m^2)\\phi = 0","Klein-Gordon eqn"],["Dirac 方程","(i\\gamma^\\mu\\partial_\\mu - m)\\psi = 0","Dirac equation"],["Gamma 矩阵","\\{\\gamma^\\mu,\\gamma^\\nu\\} = 2\\eta^{\\mu\\nu}","Gamma matrices"],["Dirac 拉氏量","\\mathcal L=\\bar\\psi(i\\gamma^\\mu\\partial_\\mu-m)\\psi","Dirac Lagrangian"],["Yang-Mills","\\mathcal L=-\\frac14F^a_{\\mu\\nu}F^{a\\mu\\nu}","Yang-Mills Lagrangian"],["场强张量","F_{\\mu\\nu}=\\partial_\\mu A_\\nu-\\partial_\\nu A_\\mu","Field strength tensor"],["协变导数","D_\\mu=\\partial_\\mu+igA_\\mu","Covariant derivative"],["Noether 流","j^\\mu=\\frac{\\partial\\mathcal L}{\\partial(\\partial_\\mu\\phi)}\\delta\\phi-K^\\mu","Noether current"],["Euler-Lagrange 场","\\partial_\\mu\\frac{\\partial\\mathcal L}{\\partial(\\partial_\\mu\\phi)}-\\frac{\\partial\\mathcal L}{\\partial\\phi}=0","Field Euler-Lagrange"],["路径积分","Z=\\int\\mathcal D\\phi\\,e^{iS[\\phi]/\\hbar}","Path integral"],["传播子","\\Delta_F(p)=\\frac{i}{p^2-m^2+i\\epsilon}","Propagator"],["QED 拉氏量","\\mathcal L_{\\mathrm{QED}}=-\\frac14F_{\\mu\\nu}F^{\\mu\\nu}+\\bar\\psi(i\\gamma^\\mu D_\\mu-m)\\psi","QED Lagrangian"],["QCD 场强","G^a_{\\mu\\nu}=\\partial_\\mu A^a_\\nu-\\partial_\\nu A^a_\\mu+gf^{abc}A^b_\\mu A^c_\\nu","QCD field strength"],["重整化群","\\beta(g)=\\mu\\frac{dg}{d\\mu}","Renormalization group"],["精细结构","\\alpha = \\frac{e^2}{4\\pi\\varepsilon_0\\hbar c}","Fine structure"],["标准模型","\\mathrm{SU}(3)_C\\times\\mathrm{SU}(2)_L\\times\\mathrm{U}(1)_Y","Standard model"],["Higgs 势","V(\\phi)=\\mu^2\\phi^\\dagger\\phi+\\lambda(\\phi^\\dagger\\phi)^2","Higgs potential"],["散射截面","d\\sigma=\\frac{1}{\\Phi}|\\mathcal M|^2d\\Pi_f","Scattering cross section"],["衰变宽度","\\Gamma=\\frac{1}{2M}\\int |\\mathcal M|^2d\\Pi_f","Decay width"],{"section":"凝聚态 / 固体物理 / 材料","sectionEn":"Condensed Matter / Solid State / Materials"},["Bloch 定理","\\psi_{n\\mathbf k}(\\mathbf r)=e^{i\\mathbf k\\cdot\\mathbf r}u_{n\\mathbf k}(\\mathbf r)","Bloch theorem"],["Drude 电导","\\sigma=\\frac{ne^2\\tau}{m}","Drude conductivity"],["Hall 系数","R_H=\\frac{1}{nq}","Hall coefficient"],["Hall 电压","V_H=\\frac{IB}{nqt}","Hall voltage"],["能带","E_n(\\mathbf k)","Band structure"],["态密度","D(E)=\\sum_n\\int\\frac{d^dk}{(2\\pi)^d}\\delta(E-E_n(\\mathbf k))","Density of states"],["费米能","E_F=\\frac{\\hbar^2}{2m}(3\\pi^2n)^{2/3}","Fermi energy"],["费米波矢","k_F=(3\\pi^2n)^{1/3}","Fermi wave vector"],["Brillouin 区","\\mathbf k\\sim\\mathbf k+\\mathbf G","Brillouin zone"],["声子色散","\\omega(k)=2\\sqrt{\\frac{K}{m}}\\left|\\sin\\frac{ka}{2}\\right|","Phonon dispersion"],["Debye 热容","C_V\\propto T^3","Debye heat capacity"],["Debye 温度","\\Theta_D=\\frac{\\hbar\\omega_D}{k_B}","Debye temperature"],["BCS 能隙","\\Delta\\sim\\hbar\\omega_D e^{-1/N(0)V}","BCS gap"],["London 方程","\\nabla^2\\mathbf B=\\frac{1}{\\lambda_L^2}\\mathbf B","London equation"],["Josephson","I=I_c\\sin\\phi","Josephson effect"],["Josephson 电压","\\frac{d\\phi}{dt}=\\frac{2eV}{\\hbar}","Josephson voltage relation"],["Landau-Ginzburg","F=\\alpha|\\psi|^2+\\frac\\beta2|\\psi|^4+\\frac1{2m}|(-i\\hbar\\nabla-q\\mathbf A)\\psi|^2","Landau-Ginzburg"],["Berry 曲率","\\Omega_n(\\mathbf k)=i\\left\\langle\\nabla_{\\mathbf k}u_n\\middle|\\times\\middle|\\nabla_{\\mathbf k}u_n\\right\\rangle","Berry curvature"],["Chern 数","C=\\frac1{2\\pi}\\int_{BZ}\\Omega(\\mathbf k)\\,d^2k","Chern number"],{"section":"核物理 / 等离子体 / 天体物理","sectionEn":"Nuclear / Plasma / Astrophysics"},["质量亏损","\\Delta E = \\Delta m\\,c^2","Mass defect"],["结合能","B=\\left(Zm_p+Nm_n-M\\right)c^2","Binding energy"],["Bethe-Weizsacker","B=a_vA-a_sA^{2/3}-a_c\\frac{Z(Z-1)}{A^{1/3}}-a_a\\frac{(A-2Z)^2}{A}+\\delta","Semi-empirical mass formula"],["反应截面","\\sigma=\\frac{\\text{rate}}{\\Phi N}","Cross section"],["放射性活度","A=\\lambda N","Radioactivity"],["衰变链","N_2(t)=\\frac{\\lambda_1N_{10}}{\\lambda_2-\\lambda_1}\\left(e^{-\\lambda_1t}-e^{-\\lambda_2t}\\right)","Decay chain"],["核反应 Q 值","Q=(m_i-m_f)c^2","Nuclear reaction Q value"],["Saha 方程","\\frac{n_{i+1}n_e}{n_i}=\\frac{2}{\\lambda_e^3}\\frac{g_{i+1}}{g_i}e^{-\\chi_i/k_BT}","Saha equation"],["等离子体频率","\\omega_p=\\sqrt{\\frac{ne^2}{\\varepsilon_0m_e}}","Plasma frequency"],["Debye 长度","\\lambda_D=\\sqrt{\\frac{\\varepsilon_0k_BT}{ne^2}}","Debye length"],["Alfven 速度","v_A=\\frac{B}{\\sqrt{\\mu_0\\rho}}","Alfven speed"],["Larmor 半径","r_L=\\frac{mv_\\perp}{|q|B}","Larmor radius"],["MHD 诱导","\\frac{\\partial\\mathbf B}{\\partial t}=\\nabla\\times(\\mathbf v\\times\\mathbf B)+\\eta\\nabla^2\\mathbf B","MHD induction"],["Jeans 长度","\\lambda_J=c_s\\sqrt{\\frac{\\pi}{G\\rho}}","Jeans length"],["Eddington 光度","L_E=\\frac{4\\pi GMm_pc}{\\sigma_T}","Eddington luminosity"],["恒星维里","2K+U=0","Stellar virial theorem"],["Lane-Emden","\\frac1{\\xi^2}\\frac{d}{d\\xi}\\left(\\xi^2\\frac{d\\theta}{d\\xi}\\right)=-\\theta^n","Lane-Emden equation"],{"section":"弦论 / 量子引力","sectionEn":"String Theory / Quantum Gravity"},["Polyakov 作用量","S=-\\frac{T}{2}\\int d^2\\sigma\\sqrt{-h}h^{ab}\\partial_aX^\\mu\\partial_bX_\\mu","Polyakov action"],["Nambu-Goto","S=-T\\int d^2\\sigma\\sqrt{-\\det\\partial_aX^\\mu\\partial_bX_\\mu}","Nambu-Goto action"],["Virasoro 代数","[L_m,L_n]=(m-n)L_{m+n}+\\frac{c}{12}m(m^2-1)\\delta_{m+n,0}","Virasoro algebra"],["世界面 CFT","T(z)T(w)\\sim\\frac{c/2}{(z-w)^4}+\\frac{2T(w)}{(z-w)^2}+\\frac{\\partial T(w)}{z-w}","Worldsheet CFT"],["T 对偶","R\\leftrightarrow\\frac{\\alpha'}{R}","T-duality"],["D 膜","X^i|_{\\partial\\Sigma}=x^i_0","D-brane"],["AdS/CFT","Z_{\\mathrm{string}}[\\phi_0]=\\left\\langle e^{\\int \\phi_0\\mathcal O}\\right\\rangle_{\\mathrm{CFT}}","AdS/CFT"],["Einstein-Hilbert","S=\\frac{1}{16\\pi G}\\int d^4x\\sqrt{-g}\\,R","Einstein-Hilbert action"]]},{"id":"chemistry","structures":true,"items":[{"section":"常用书写 / 反应模板","sectionEn":"Common Writing / Reaction Templates"},["化学式","\\mathrm{#?}","Formula"],["反应式","\\mathrm{#?}\\rightarrow\\mathrm{#?}","Reaction"],["可逆","\\mathrm{#?}\\rightleftharpoons\\mathrm{#?}","Reversible"],["共振","\\mathrm{#?}\\leftrightarrow\\mathrm{#?}","Resonance"],["上下箭头","\\mathrm{#?}\\xrightarrow[#?]{#?}\\mathrm{#?}","Arrow with text"],["离子方程","\\mathrm{#?}^{+}+\\mathrm{#?}^{-}\\rightarrow\\mathrm{#?}\\downarrow","Ionic equation"],["净离子","\\mathrm{#?}_{(aq)}+\\mathrm{#?}_{(aq)}\\rightarrow\\mathrm{#?}_{(s)}","Net ionic equation"],["酸碱反应","\\ce{HA + OH- -> A- + H2O}","Acid-base reaction"],["氧化还原","\\ce{Ox + ne- -> Red}","Redox reaction"],["燃烧反应","\\ce{C_xH_y + O2 -> CO2 + H2O}","Combustion reaction"],["沉淀反应","\\ce{Ag+ + Cl- -> AgCl v}","Precipitation reaction"],["络合反应","\\ce{M^{n+} + xL <=> [ML_x]^{n+}}","Complexation reaction"],["水合物","\\mathrm{#?}\\cdot#?\\mathrm{H_2O}","Hydrate"],["同位素","{}^{#?}_{#?}\\mathrm{#?}","Isotope notation"],["电子","\\ce{e-}","Electron"],["催化剂","\\mathrm{#?}\\xrightarrow{\\mathrm{cat.}}\\mathrm{#?}","Catalyst arrow"],["加热","\\mathrm{#?}\\xrightarrow{\\Delta}\\mathrm{#?}","Heat arrow"],["→","\\rightarrow"],["⇌","\\rightleftharpoons"],["↑","\\uparrow"],["↓","\\downarrow"],["aq","\\mathrm{(aq)}"],["s","\\mathrm{(s)}"],["l","\\mathrm{(l)}"],["g","\\mathrm{(g)}"],{"section":"常见分子 / 无机物","sectionEn":"Common Molecules / Inorganic Compounds"},["H₂O","\\ce{H2O}","Water"],["H₂","\\ce{H2}","Hydrogen"],["O₂","\\ce{O2}","Oxygen"],["N₂","\\ce{N2}","Nitrogen"],["Cl₂","\\ce{Cl2}","Chlorine"],["CO₂","\\ce{CO2}","Carbon dioxide"],["CO","\\ce{CO}","Carbon monoxide"],["NO","\\ce{NO}","Nitric oxide"],["NO₂","\\ce{NO2}","Nitrogen dioxide"],["SO₂","\\ce{SO2}","Sulfur dioxide"],["SO₃","\\ce{SO3}","Sulfur trioxide"],["H₂S","\\ce{H2S}","Hydrogen sulfide"],["NaCl","\\ce{NaCl}","Sodium chloride"],["HCl","\\ce{HCl}","Hydrochloric acid"],["HF","\\ce{HF}","Hydrofluoric acid"],["HBr","\\ce{HBr}","Hydrobromic acid"],["HI","\\ce{HI}","Hydroiodic acid"],["H₂SO₄","\\ce{H2SO4}","Sulfuric acid"],["HNO₃","\\ce{HNO3}","Nitric acid"],["H₃PO₄","\\ce{H3PO4}","Phosphoric acid"],["H₂CO₃","\\ce{H2CO3}","Carbonic acid"],["NH₃","\\ce{NH3}","Ammonia"],["NaOH","\\ce{NaOH}","Sodium hydroxide"],["KOH","\\ce{KOH}","Potassium hydroxide"],["CaO","\\ce{CaO}","Calcium oxide"],["MgO","\\ce{MgO}","Magnesium oxide"],["NH₄Cl","\\ce{NH4Cl}","Ammonium chloride"],["Na₂CO₃","\\ce{Na2CO3}","Sodium carbonate"],["NaHCO₃","\\ce{NaHCO3}","Sodium bicarbonate"],["KCl","\\ce{KCl}","Potassium chloride"],["KNO₃","\\ce{KNO3}","Potassium nitrate"],["AgNO₃","\\ce{AgNO3}","Silver nitrate"],["H₂O₂","\\ce{H2O2}","Hydrogen peroxide"],["KMnO₄","\\ce{KMnO4}","Potassium permanganate"],["K₂Cr₂O₇","\\ce{K2Cr2O7}","Potassium dichromate"],["CaCO₃","\\ce{CaCO3}","Calcium carbonate"],["CuSO₄","\\ce{CuSO4}","Copper sulfate"],["Ca(OH)₂","\\ce{Ca(OH)2}","Calcium hydroxide"],["Fe₂O₃","\\ce{Fe2O3}","Iron(III) oxide"],["AgCl","\\ce{AgCl}","Silver chloride"],["BaSO₄","\\ce{BaSO4}","Barium sulfate"],["SiO₂","\\ce{SiO2}","Silicon dioxide"],["Al₂O₃","\\ce{Al2O3}","Aluminium oxide"],["CuO","\\ce{CuO}","Copper oxide"],["MnO₂","\\ce{MnO2}","Manganese dioxide"],["PbI₂","\\ce{PbI2}","Lead iodide"],["FeCl₃","\\ce{FeCl3}","Iron(III) chloride"],["Na₂S₂O₃","\\ce{Na2S2O3}","Sodium thiosulfate"],{"section":"离子 / 水溶液","sectionEn":"Ions / Aqueous Chemistry"},["H⁺","\\ce{H+}","Proton"],["OH⁻","\\ce{OH-}","Hydroxide"],["Na⁺","\\ce{Na+}","Sodium ion"],["K⁺","\\ce{K+}","Potassium ion"],["Ag⁺","\\ce{Ag+}","Silver ion"],["Ca²⁺","\\ce{Ca^2+}","Calcium ion"],["Mg²⁺","\\ce{Mg^2+}","Magnesium ion"],["Ba²⁺","\\ce{Ba^2+}","Barium ion"],["Cu²⁺","\\ce{Cu^2+}","Copper(II)"],["Zn²⁺","\\ce{Zn^2+}","Zinc ion"],["Al³⁺","\\ce{Al^3+}","Aluminium ion"],["SO₄²⁻","\\ce{SO4^2-}","Sulfate"],["NO₃⁻","\\ce{NO3-}","Nitrate"],["CO₃²⁻","\\ce{CO3^2-}","Carbonate"],["HCO₃⁻","\\ce{HCO3-}","Bicarbonate"],["PO₄³⁻","\\ce{PO4^3-}","Phosphate"],["Cl⁻","\\ce{Cl-}","Chloride"],["Br⁻","\\ce{Br-}","Bromide"],["I⁻","\\ce{I-}","Iodide"],["F⁻","\\ce{F-}","Fluoride"],["MnO₄⁻","\\ce{MnO4-}","Permanganate"],["Cr₂O₇²⁻","\\ce{Cr2O7^2-}","Dichromate"],["S₂O₃²⁻","\\ce{S2O3^2-}","Thiosulfate"],["CH₃COO⁻","\\ce{CH3COO-}","Acetate"],["NH₄⁺","\\ce{NH4+}","Ammonium"],["Fe²⁺","\\ce{Fe^2+}","Iron(II)"],["Fe³⁺","\\ce{Fe^3+}","Iron(III)"],["络离子","\\ce{[Cu(NH3)4]^2+}","Complex ion"],["六氨合钴","\\ce{[Co(NH3)6]^3+}","Hexaamminecobalt(III)"],["氰合银","\\ce{[Ag(CN)2]-}","Dicyanoargentate"],{"section":"酸碱 / 平衡 / 滴定","sectionEn":"Acid-Base / Equilibrium / Titration"},["pH","\\mathrm{pH} = -\\log[\\ce{H+}]","pH"],["pOH","\\mathrm{pOH} = -\\log[\\ce{OH-}]","pOH"],["Kw","K_w = [\\ce{H+}][\\ce{OH-}] = 10^{-14}","Kw"],["Ka","K_a = \\frac{[\\ce{H+}][\\ce{A-}]}{[\\ce{HA}]}","Ka"],["Henderson-Hasselbalch","\\mathrm{pH} = \\mathrm{p}K_a + \\log\\frac{[\\ce{A-}]}{[\\ce{HA}]}","Henderson-Hasselbalch"],["平衡常数","K_c = \\frac{[\\ce{C}]^c[\\ce{D}]^d}{[\\ce{A}]^a[\\ce{B}]^b}","Equilibrium constant"],["反应商","Q = \\frac{[\\ce{C}]^c[\\ce{D}]^d}{[\\ce{A}]^a[\\ce{B}]^b}","Reaction quotient"],["Kp-Kc","K_p=K_c(RT)^{\\Delta n}","Kp and Kc relation"],["溶度积","K_{sp}=[\\ce{M^{n+}}]^a[\\ce{X^{m-}}]^b","Solubility product"],["络合常数","K_f=\\frac{[\\ce{ML_x}]}{[\\ce{M}][\\ce{L}]^x}","Formation constant"],["电离度","\\alpha=\\frac{x}{c_0}","Degree of dissociation"],["缓冲容量","\\beta=\\frac{dn}{d\\mathrm{pH}}","Buffer capacity"],["分布系数","D=\\frac{c_{\\mathrm{org}}}{c_{\\mathrm{aq}}}","Distribution coefficient"],["Henry 定律","c=k_HP","Henry law"],["Raoult 定律","p_i=x_ip_i^*","Raoult law"],["依数性","\\Delta T_b=iK_bm","Boiling point elevation"],["凝固点降低","\\Delta T_f=iK_fm","Freezing point depression"],["渗透压","\\Pi=iMRT","Osmotic pressure"],["滴定当量点","n_a = n_b","Titration equivalence"],["酸碱滴定","C_aV_a=C_bV_b","Acid-base titration"],["EDTA 络合","\\ce{M^{n+} + Y^{4-} -> MY^{(n-4)-}}","EDTA complexometric titration"],["指示剂","\\ce{Phth}","Indicator"],{"section":"热力学 / 电化学 / 动力学","sectionEn":"Thermodynamics / Electrochemistry / Kinetics"},["理想气体","PV=nRT","Ideal gas law"],["化学势","\\mu_i=\\mu_i^\\circ+RT\\ln a_i","Chemical potential"],["活度","a_i=\\gamma_i\\frac{c_i}{c^\\circ}","Activity"],["逸度","\\mu=\\mu^\\circ+RT\\ln\\frac{f}{f^\\circ}","Fugacity"],["ΔH","\\Delta H","Enthalpy change"],["ΔS","\\Delta S","Entropy change"],["ΔG","\\Delta G = \\Delta H - T\\Delta S","Gibbs free energy"],["ΔG°","\\Delta G^\\circ = -RT\\ln K","Standard Gibbs"],["Hess 定律","\\Delta H=\\sum_i\\nu_i\\Delta H_{f,i}^\\circ","Hess law"],["热容","q=mc\\Delta T","Heat capacity"],["Gibbs-Helmholtz","\\left(\\frac{\\partial(G/T)}{\\partial T}\\right)_p=-\\frac{H}{T^2}","Gibbs-Helmholtz"],["van't Hoff","\\ln\\frac{K_2}{K_1} = -\\frac{\\Delta H^\\circ}{R}\\left(\\frac1{T_2}-\\frac1{T_1}\\right)","van't Hoff eqn"],["Clapeyron","\\frac{dP}{dT} = \\frac{\\Delta S}{\\Delta V}","Clapeyron eqn"],["Clausius-Clapeyron","\\ln\\frac{P_2}{P_1}=-\\frac{\\Delta H_{vap}}{R}\\left(\\frac1{T_2}-\\frac1{T_1}\\right)","Clausius-Clapeyron"],["Boltzmann 分布","\\frac{N_i}{N}=\\frac{g_ie^{-E_i/kT}}{Z}","Boltzmann distribution"],["配分函数","Z=\\sum_i g_i e^{-E_i/kT}","Partition function"],["能斯特","E = E^\\circ - \\frac{RT}{nF}\\ln Q","Nernst equation"],["电池电动势","E_{cell}=E_{cathode}-E_{anode}","Cell potential"],["Faraday 定律","m=\\frac{Q M}{nF}","Faraday electrolysis law"],["电池符号","\\ce{Zn | Zn^2+ || Cu^2+ | Cu}","Cell notation"],["Butler-Volmer","j=j_0\\left(e^{\\alpha_aF\\eta/RT}-e^{-\\alpha_cF\\eta/RT}\\right)","Butler-Volmer equation"],["Tafel","\\eta=a+b\\log j","Tafel equation"],["Debye-Hückel","\\log\\gamma_i=-Az_i^2\\sqrt I","Debye-Huckel limiting law"],["离子强度","I=\\frac12\\sum_i c_i z_i^2","Ionic strength"],["电导率","\\kappa=\\sum_i \\lambda_i c_i","Conductivity"],["半反应","\\ce{oxid + ne- -> red}","Half-reaction"],["法拉第常数","F = 96485\\,\\mathrm{C\\,mol^{-1}}","Faraday constant"],["Arrhenius","k = Ae^{-E_a/RT}","Arrhenius eqn"],["Eyring","k=\\frac{k_BT}{h}e^{-\\Delta G^\\ddagger/RT}","Eyring equation"],["速率方程","\\text{rate} = k[\\ce{A}]^m[\\ce{B}]^n","Rate law"],["零级反应","[A]=[A]_0-kt","Zero-order reaction"],["一级反应","\\ln[A]=\\ln[A]_0-kt","First-order reaction"],["二级反应","\\frac1{[A]}=\\frac1{[A]_0}+kt","Second-order reaction"],["半衰期","t_{1/2}=\\frac{\\ln2}{k}","Half-life"],["Michaelis-Menten","v=\\frac{V_{max}[S]}{K_M+[S]}","Michaelis-Menten"],["Langmuir","\\theta = \\frac{KP}{1+KP}","Langmuir isotherm"],["键离解能","D_{298} = 436\\,\\mathrm{kJ\\,mol^{-1}}","Bond dissociation energy"],{"section":"有机 / 官能团 / 杂化","sectionEn":"Organic / Functional Groups / Hybridization"},["CH₄","\\ce{CH4}","Methane"],["乙烯","\\ce{CH2=CH2}","Ethene"],["乙炔","\\ce{HC#CH}","Ethyne"],["C₂H₅OH","\\ce{C2H5OH}","Ethanol"],["C₆H₆","\\ce{C6H6}","Benzene"],["CH₃COOH","\\ce{CH3COOH}","Acetic acid"],["葡萄糖","\\ce{C6H12O6}","Glucose"],["丙酮","\\ce{(CH3)2CO}","Acetone"],["甲苯","\\ce{C6H5CH3}","Toluene"],["羟基","\\ce{-OH}","Hydroxyl group"],["羧基","\\ce{-COOH}","Carboxyl group"],["羰基","\\ce{C=O}","Carbonyl group"],["氨基","\\ce{-NH2}","Amino group"],["醛基","\\ce{-CHO}","Aldehyde group"],["酯基","\\ce{-COOR}","Ester group"],["醚键","\\ce{R-O-R'}","Ether group"],["酰胺","\\ce{-CONH2}","Amide group"],["腈基","\\ce{-CN}","Nitrile group"],["硝基","\\ce{-NO2}","Nitro group"],["苯基","\\ce{-C6H5}","Phenyl group"],["sp³ 杂化","\\ce{CH4} \\text{ sp}^3","sp3 hybridization"],["sp² 杂化","\\ce{C2H4} \\text{ sp}^2","sp2 hybridization"],["sp 杂化","\\ce{C2H2} \\text{ sp}","sp hybridization"],["SN1","\\ce{R-X -> R+ + X- -> R-Nu}","SN1 mechanism"],["SN2","\\ce{Nu- + R-X -> R-Nu + X-}","SN2 mechanism"],["E1","\\ce{R-X -> R+ -> alkene}","E1 elimination"],["E2","\\ce{Base + R-CH2-CH2-X -> alkene + HB + X-}","E2 elimination"],["亲电加成","\\ce{C=C + E+ -> C-C+}","Electrophilic addition"],["芳香取代","\\ce{Ar-H + E+ -> Ar-E + H+}","Electrophilic aromatic substitution"],["Grignard","\\ce{R-MgX + R'CHO -> R'CH(OH)R}","Grignard reaction"],["Diels-Alder","\\ce{diene + dienophile -> cyclohexene}","Diels-Alder reaction"],["聚合","n\\ce{CH2=CH2} \\to \\ce{-(CH2CH2)-}_n","Polymerization"],["酯化","\\ce{RCOOH + R'OH <=> RCOOR' + H2O}","Esterification"],{"section":"生物化学 / 高分子","sectionEn":"Biochemistry / Polymer Chemistry"},["氨基酸","\\ce{H2N-CHR-COOH}","Amino acid"],["肽键","\\ce{R-COOH + H2N-R' -> R-CONH-R' + H2O}","Peptide bond"],["ATP 水解","\\ce{ATP + H2O -> ADP + Pi + H+}","ATP hydrolysis"],["NADH 氧化","\\ce{NADH -> NAD+ + H+ + 2e-}","NADH oxidation"],["葡萄糖氧化","\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O}","Glucose oxidation"],["聚合度","X_n=\\frac{M_n}{M_0}","Degree of polymerization"],["数均分子量","M_n=\\frac{\\sum_i N_iM_i}{\\sum_i N_i}","Number-average molar mass"],["重均分子量","M_w=\\frac{\\sum_i N_iM_i^2}{\\sum_i N_iM_i}","Weight-average molar mass"],["分散系数","\\mathrm{PDI}=\\frac{M_w}{M_n}","Dispersity"],["Flory-Huggins","\\frac{\\Delta G_{mix}}{RT}=\\frac{\\phi_1}{N_1}\\ln\\phi_1+\\frac{\\phi_2}{N_2}\\ln\\phi_2+\\chi\\phi_1\\phi_2","Flory-Huggins"],{"section":"量子 / 固体 / 材料","sectionEn":"Quantum / Solid-State / Materials"},["Schrödinger","\\hat H\\psi=E\\psi","Schrodinger equation"],["Hartree-Fock","\\hat F\\phi_i=\\epsilon_i\\phi_i","Hartree-Fock equation"],["DFT","E[\\rho]=T_s[\\rho]+E_{xc}[\\rho]+\\int v\\rho\\,dr","Density functional theory"],["HOMO-LUMO","\\Delta E=E_{LUMO}-E_{HOMO}","HOMO-LUMO gap"],["Bragg 定律","n\\lambda=2d\\sin\\theta","Bragg law"],["晶面间距","d_{hkl}=\\frac{a}{\\sqrt{h^2+k^2+l^2}}","Cubic lattice spacing"],["缺陷浓度","n=N\\exp\\left(-\\frac{E_f}{k_BT}\\right)","Defect concentration"],["能带隙","E_g=E_c-E_v","Band gap"],{"section":"结构 / 光谱 / 分析","sectionEn":"Structure / Spectroscopy / Analysis"},["电子组态","1s^2\\,2s^2\\,2p^6\\,3s^2\\,3p^6","Electron config"],["Beer-Lambert","A = \\varepsilon cl","Beer-Lambert law"],["校准曲线","A=kc+b","Calibration curve"],["检出限","\\mathrm{LOD}=\\frac{3\\sigma}{S}","Limit of detection"],["定量限","\\mathrm{LOQ}=\\frac{10\\sigma}{S}","Limit of quantification"],["保留因子","k' = \\frac{t_R-t_M}{t_M}","Chromatographic capacity factor"],["分离度","R_s=\\frac{2(t_{R,2}-t_{R,1})}{w_1+w_2}","Chromatographic resolution"],["Rf","R_f=\\frac{d_{spot}}{d_{solvent}}","Retention factor"],["量子产率","\\Phi = \\frac{k_r}{k_r + k_{nr}}","Quantum yield"],["化学位移","\\delta = \\frac{\\nu - \\nu_{\\mathrm{TMS}}}{\\nu_0}","NMR chemical shift"],["NMR 裂分","n\\text{ neighbors}\\implies n+1\\text{ peaks}","NMR splitting rule"],["J 耦合","\\Delta\\nu=J","J coupling"],["质荷比","m/z","Mass-to-charge ratio"],["红外吸收","\\tilde{\\nu} = \\frac{1}{2\\pi c}\\sqrt{\\frac{k}{\\mu}}","IR absorption"],["紫外跃迁","E=h\\nu=\\frac{hc}{\\lambda}","UV transition"],["Lambert-Beer","T=10^{-A}","Transmittance"]]},{"id":"misc","structures":false,"items":[["⋯","\\cdots"],["…","\\dots"],["⋮","\\vdots"],["⋱","\\ddots"],["∞","\\infty"],["ℏ","\\hbar"],["ℏ","\\hslash"],["ℓ","\\ell"],["°","^\\circ"],["ℜ","\\Re"],["ℑ","\\Im"],["℘","\\wp"],["ı","\\imath"],["ȷ","\\jmath"],["∠","\\angle"],["∡","\\measuredangle"],["∢","\\sphericalangle"],["ℵ","\\aleph"],["ℶ","\\beth"],["ℷ","\\gimel"],["ℸ","\\daleth"],["℧","\\mho"],["𝕜","\\Bbbk"],["Ⓢ","\\circledS"],["✠","\\maltese"],["‵","\\backprime"],["‶","\\backdoubleprime"],["★","\\bigstar"],["✓","\\checkmark"],["♠","\\spadesuit"],["♥","\\heartsuit"],["♣","\\clubsuit"],["♦","\\diamondsuit"],["♮","\\natural"],["♭","\\flat"],["♯","\\sharp"],["§","\\S"],["¶","\\P"],["©","\\copyright"],["®","\\circledR"],["¥","\\yen"],["£","\\pounds"],["µ","\\textmu"],["ð","\\eth"],["Ⅎ","\\Finv"],["⅁","\\Game"],["□","\\Box"],["■","\\blacksquare"],["◇","\\Diamond"],["◆","\\blacklozenge"],["▲","\\blacktriangle"],["℃","{}^\\circ\\mathrm{C}"],["℉","{}^\\circ\\mathrm{F}"],["⌀","⌀"],["╱","\\diagup"],["▼","\\blacktriangledown"]]}]};

function loadBundledFallback() {
  if (BUNDLED_FALLBACK && BUNDLED_FALLBACK.GROUPS && BUNDLED_FALLBACK.GROUPS.length) {
    FORMULA_DATA = BUNDLED_FALLBACK;
    log("Loaded bundled fallback data,", BUNDLED_FALLBACK.GROUPS.length, "groups");
    return true;
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
      return loadBundledFallback();
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

    containerEl.createEl("h3", { text: ui(p, "shortcuts") });
    containerEl.createEl("p", { text: ui(p, "shortcutsDesc"), cls: "setting-item-description" });

    const sc = p.settings.shortcuts || {};
    const shortcutDefs = [
      { key: "fraction", label: ui(p, "shortcutFraction"), placeholder: "e.g. ctrl+f" },
      { key: "sqrt", label: ui(p, "shortcutSqrt"), placeholder: "e.g. ctrl+r" },
      { key: "superscript", label: ui(p, "shortcutSuper"), placeholder: "e.g. ctrl+h" },
      { key: "subscript", label: ui(p, "shortcutSub"), placeholder: "e.g. ctrl+l" },
      { key: "subSuper", label: ui(p, "shortcutSubSuper"), placeholder: "e.g. ctrl+j" },
    ];

    for (const def of shortcutDefs) {
      new obsidian.Setting(containerEl)
        .setName(def.label)
        .setDesc(sc[def.key] || (loc(p) === "zh" ? "未绑定" : "Unbound"))
        .addText((t) => t
          .setPlaceholder(def.placeholder)
          .setValue(sc[def.key] || "")
          .onChange(async (v) => {
            p.settings.shortcuts[def.key] = v.trim();
            await p.saveSettings();
          }));
    }

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
      document.querySelectorAll('script[src*="mathlive"]').forEach((el) => el.remove());
    } catch (_) {}
    try {
      const leaves = this.app.workspace.getLeavesOfType("formula-library-sidebar");
      for (const leaf of leaves) {
        try { leaf.detach(); } catch (_) {}
      }
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

      this.latexSource = this.previewEl.createEl("textarea", {
        cls: "fe-latex-inline",
        attr: { spellcheck: "false", placeholder: "LaTeX source...", rows: "2" },
      });
      this.latexSource.value = this.initLatex || "";

      ["mousedown", "mouseup", "mousemove", "click", "dblclick"].forEach((evt) => {
        this.mf.addEventListener(evt, (e) => e.stopPropagation(), true);
      });

      this.mf.addEventListener("input", () => {
        const val = this.mf.value || "";
        this.sourceTA.value = val;
        if (this.latexSource !== document.activeElement) {
          this.latexSource.value = val;
        }
      });

      this.latexSource.addEventListener("input", () => {
        const val = this.latexSource.value;
        this.mf.value = val;
        this.sourceTA.value = val;
      });
      this.latexSource.addEventListener("focus", () => {
        this.latexSource.value = this.mf.value || "";
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
      if (this.latexSource) this.latexSource.value = this.mf.value || "";
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
    const sc = this.plugin.settings.shortcuts || {};
    const map = {};
    if (sc.fraction) map[sc.fraction] = "\\frac{}{}";
    if (sc.sqrt) map[sc.sqrt] = "\\sqrt{}";
    if (sc.superscript) map[sc.superscript] = "^{}";
    if (sc.subscript) map[sc.subscript] = "_{}";
    if (sc.subSuper) map[sc.subSuper] = "_{}^{}";
    const combo = (e.ctrlKey ? "ctrl+" : "") + (e.shiftKey ? "shift+" : "") + (e.altKey ? "alt+" : "") + (e.metaKey ? "meta+" : "") + e.key.toLowerCase();
    if (map[combo]) {
      e.preventDefault();
      this.insertIntoEditor(map[combo]);
      return;
    }
    if (e.key === "Enter" && e.shiftKey && !e.isComposing && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.accept();
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
