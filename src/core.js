import SEARCH_ALIASES from "./data/search-aliases.json";
import PINYIN_INITIALS from "./data/pinyin.json";
import * as obsidian from "obsidian";
import BUNDLED_FALLBACK from "./data/formulas.json";
import { DEFAULT_ENABLED_TOOLS } from "./tools.js";

let FORMULA_DATA = null;
const DEFAULT_SETTINGS = {
  locale: "auto",
  insertFormat: "display",
  defaultEditorMode: "visual",
  enabledTools: { ...DEFAULT_ENABLED_TOOLS },
  mathliveKeyboard: true,
  formulasPath: "formulas",
  previewFontSize: 20,
  libraryFontFollowObsidian: true,
  libraryFontSize: 18,
  mathFontStyle: "italic",
  mathFontFamily: "",
  enabledGroups: {},
  builtinLibraryEnabled: true,
  customFormulasPath: "",
  plotFolder: "plots",
  customEnabledGroups: {},
  drawingDraft: null,
  formulaDraft: null,
  plotDraft: null,
  rememberDrafts: true,
  plotPresets: [],
  paramPresets: {},
  customParamTemplates: [],
  libraryDensity: "comfortable",
  librarySort: "smart",
  searchResultLimit: 160,
  showLatexLabels: true,
  shortcuts: {
    fraction: "",
    sqrt: "",
    superscript: "",
    subscript: "",
    subSuper: "",
  },
  usageCounts: {},
  favorites: [],
  pinnedFormulas: [],
  hiddenFormulas: [],
  recentFormulas: [],
};
const LOG_PREFIX = "[FormulaLib]";
const UI_STRINGS = {
  en: {
    title: "Formula Editor", visual: "Visual", source: "Source", search: "Search all formulas ...", preview: "Type LaTeX below", noEditor: "No active editor", openEditor: "Open Editor", editMode: "Edit mode", cancel: "Cancel", acceptInsert: "Insert", acceptUpdate: "Update", ready: "Ready",
    favorites: "Favorites", allFormulas: "All", recent: "Recent", pinned: "Pinned", hidden: "Hidden", noResults: "No formulas match this view.", drawing: "Diagram", drawingTitle: "Mermaid Diagram", drawingInsert: "Insert diagram", drawingPreview: "Preview", drawingSource: "Source", drawingTemplate: "Template", favHint: "Save a formula for quick access", favOnly: "Show favorites only", clearFavs: "Clear all favorites",
    drawingUndo: "Undo", drawingRedo: "Redo", drawingRestoreOriginal: "Restore original", drawingDraftRestored: "Restored the previous draft", drawingIncompatible: "Visual editing is unavailable: this source uses syntax the visual editor cannot represent, so the original source is kept.", drawingUnsupported: "Unsupported line(s)", drawingLossless: "Visual editing is lossless for this source.", drawingTemplateReplaced: "Template applied. Use Undo to bring the previous source back.", drawingEditExisting: "Edit this diagram", drawingZoomIn: "Zoom in", drawingZoomOut: "Zoom out", drawingZoomReset: "Reset zoom", drawingFit: "Fit to view", drawingExportSvg: "Export SVG", drawingExportSvgDone: "SVG exported", drawingExportSvgFailed: "No rendered diagram to export", drawingPanHint: "Drag to pan, Ctrl+wheel to zoom",
    paramTemplates: "Templates", paramTitle: "Parameterized Formula", paramDesc: "Fill in the named parameters; the LaTeX below follows your input.", paramPreset: "Preset", paramPresetNone: "No preset", paramPresetName: "Preset name", paramPresetNameRequired: "Enter a preset name", paramPresetSaved: "Preset saved", paramPresetDeleted: "Preset deleted", paramPresetDelete: "Delete preset", paramInsert: "Insert into note", paramUseInEditor: "Use in editor", paramLatex: "Generated LaTeX", paramNoTemplates: "No templates available", paramReset: "Reset values", saveToLibrary: "Save to my library", saveToLibraryTitle: "Save to my library", saveToLibraryGroup: "Category", saveToLibraryNewGroup: "New category name (optional)", saveToLibraryNoLatex: "Nothing to save yet - write a formula first", saveToLibrarySaved: "Saved to your library", saveToLibraryUpdated: "Updated the matching entry in your library", itemTags: "Tags", itemTagsPlaceholder: "comma or space separated, e.g. algebra, exam", itemNote: "Note", itemNotePlaceholder: "What it is used for, when it applies, common variations", saveToLibraryDesc: "Name, tags, and note are stored with the formula in your own folder; the built-in library stays untouched.", itemNameRequired: "Enter a formula name.", saveToLibraryDefaultGroup: "My formulas",
    matrixPaste: "Paste matrix data", matrixPasteTitle: "Matrix from Pasted Data", matrixPasteDesc: "Paste rows copied from a spreadsheet or plain text: tab, comma, semicolon, pipe, or space separated.", matrixPastePlaceholder: "1\t2\t3\n4\t5\t6", matrixEnv: "Environment", matrixDelim: "Separator", matrixDelimAuto: "Detect automatically", matrixDelimTab: "Tab", matrixDelimComma: "Comma", matrixDelimSemicolon: "Semicolon", matrixDelimPipe: "Pipe", matrixDelimSpace: "Space", matrixSize: "{r} rows x {c} columns", matrixEmpty: "Paste some data to build a matrix.", matrixWrapText: "Wrap text cells in \\text{}", matrixTranspose: "Transpose", matrixAddRow: "Add row", matrixRemoveRow: "Remove row", matrixAddColumn: "Add column", matrixRemoveColumn: "Remove column", matrixCopy: "Copy LaTeX", matrixCopied: "LaTeX copied to the clipboard", matrixEnvBmatrix: "Brackets [ ]", matrixEnvPmatrix: "Parentheses ( )", matrixEnvMatrix: "Plain matrix", matrixEnvVmatrix: "Single bars | |", matrixEnvVmatrixBig: "Double bars || ||", matrixEnvArray: "Array with brackets", matrixEnvCases: "Cases", matrixEnvAligned: "Aligned equations",
    plotTitle: "Plot Function", plotDesc: "Draw y = f(x) from a typed expression; every letter except x becomes a slider.", plotFunctions: "Functions", plotAddFunction: "Add function", plotRemoveFunction: "Remove", plotExpressionPlaceholder: "y = a x^2 + b", plotParameters: "Parameters", plotNoParams: "no parameters", plotXMin: "x min", plotXMax: "x max", plotYMin: "y min", plotYMax: "y max", plotAutoY: "Auto y", plotTheme: "Theme", plotThemeAuto: "Follow theme", plotThemeLight: "Light", plotThemeDark: "Dark", plotFolder: "Image folder", plotStatus: "{n} curve(s) - parameters: {params}", plotParseError: "Cannot parse", plotNoFunction: "Enter a function first", plotInsertSvg: "Insert SVG", plotInsertFile: "Save image and embed", plotCopySvg: "Copy SVG", plotCopied: "SVG copied to the clipboard", plotDownloadSvg: "Download SVG", plotInserted: "Added to the note", plotInsertFailed: "Could not add the plot", plotDefinitions: "Function definitions", plotDefinitionsHint: "One per line, e.g. f(x) = x^2 + a. Definitions can use sliders and the functions defined above them.", plotDefinitionsPlaceholder: "f(x) = x^2 + a", plotLocals: "Local constants", plotLocalsPlaceholder: "a=2, b=-1", plotThemeHint: "Inline inserts follow the theme; copy, download and saved images bake the current theme.", plotLine: "line {n}", plotDefSyntax: "Use the form name(params) = expression", plotDefName: "Invalid or reserved function name", plotDefParams: "Parameter names must be valid and unique", plotDefBody: "Cannot parse the definition body", plotDefUnknownFunction: "Unknown function in the definition", plotLocalsSyntax: "Use the form a=2", plotLocalsName: "Invalid local constant name", plotLocalsValue: "Cannot evaluate this value", plotLocalsError: "Local constants error",
    settingsTitle: "Formula Library Settings",
    language: "Language", languageDesc: "UI language. 'auto' follows Obsidian setting.",
    insertFormat: "Insert format", insertFormatDesc: "How formulas are wrapped when inserted.",
    defaultMode: "Default editor mode", defaultModeDesc: "Visual or source mode on open.",
    mathliveKbd: "MathLive virtual keyboard", mathliveKbdDesc: "Enable virtual keyboard in visual mode.",
    formulasFolder: "Formulas folder", formulasFolderDesc: "Path to formulas folder relative to plugin directory.",
    fontSize: "Preview font size", fontSizeDesc: "Font size (px) for MathLive editor.",
    libraryFontFollow: "Follow Obsidian font size", libraryFontFollowDesc: "Formula names, source labels and library controls follow Appearance → Font size in both the editor and sidebar. Does not change the MathLive preview font.",
    libraryFontSize: "Formula library font size", libraryFontSizeDesc: "Independent library text size (14–32 px). Turn off Follow Obsidian font size to adjust; open libraries update immediately.",
    fontStyle: "Math font style", fontStyleDesc: "Italic (default) or upright math rendering.",
    fontFamily: "Custom font family", fontFamilyDesc: "Override math font. Leave empty for KaTeX default.",
    density: "Library density", densityDesc: "Controls formula card size and spacing.",
    sortMode: "Formula sorting", sortModeDesc: "Choose how formulas are ordered within each category.",
    resultLimit: "Search result limit", resultLimitDesc: "Limits rendered results to keep mobile scrolling responsive.",
    showLatexLabels: "Show LaTeX labels", showLatexLabelsDesc: "Show source snippets under formula names.",
    resetHidden: "Restore hidden formulas", resetHiddenDesc: "Makes every hidden formula visible again.",
    groupsTitle: "Formula Groups", groupsDesc: "Toggle which groups are visible. Add JSON files to formulas/ then click Refresh.",
    refreshBtn: "Refresh", refreshDesc: "Detect new formula files and reload.",
    enableAll: "Enable all",
    disableAll: "Disable all",
    libraryTitle: "Formula library sources",
    libraryDesc: "Built-in formulas ship with the plugin. Custom formulas load from your own folder, independently of the built-in switch.",
    builtinLibrary: "Built-in formula library", builtinLibraryDesc: "Controls whether the built-in categories are used. Turning it off keeps favorites, pins, history and category switches.",
    customLibrary: "Custom formula library", customLibraryDesc: "Your own JSON formula folders, loaded independently of the built-in library.",
    customPath: "Custom formulas folder", customPathDesc: "Path relative to the vault root, e.g. my-formulas. Leave empty to disable. Changes reload the library automatically.",
    customEmpty: "No custom formula files detected.",
    groupsEmpty: "No built-in categories available.",
    enableAllGroups: "All built-in categories", enableAllGroupsDesc: "Turn every built-in category on or off at once.", customSuffix: "Custom",
    shortcuts: "Keyboard Shortcuts", shortcutsDesc: "Custom shortcuts for formula insertion (e.g. ctrl+f, ctrl+shift+f).",
    shortcutFraction: "Fraction (\\frac)", shortcutSqrt: "Square Root (\\sqrt)", shortcutSuper: "Superscript (^{})", shortcutSub: "Subscript (_{})", shortcutSubSuper: "Sub & Super (_{}^{})",
    confirm: "Delete", save: "Save",
    customManage: "Manage custom formulas", customManageDesc: "Add, edit, import and export the formulas in your own folder.",
    manageTitle: "Custom formulas", manageNewGroup: "New category", manageAddFormula: "Add formula", manageEditFormula: "Edit", manageDeleteFormula: "Delete", manageRenameGroup: "Rename", manageDeleteGroup: "Delete category", manageExportGroup: "Export", manageEmpty: "No formulas in this category yet.", manageFolder: "Folder",
    itemName: "Name", itemNameEn: "English name (optional)", itemLatex: "LaTeX",
    groupName: "Category name", groupNameRequired: "Enter a category name.", groupExists: "That category already exists.",
    latexNoDollar: "Write LaTeX without $ delimiters.", latexBraces: "Unbalanced braces { }.", latexDuplicate: "This LaTeX already exists",
    importTitle: "Import formulas", importDesc: "Paste a JSON array, a JSON backup, or one \"name<TAB>latex\" per line.", importTarget: "Add to", importNewGroup: "New category name", importModeNew: "New category", importResult: "Imported", importSkipped: "Skipped", importNothing: "Nothing to import.",
    exportTitle: "Export formulas", exportAll: "All custom formulas", exportFormatLines: "Plain text", exportFormatJson: "JSON backup", exportCopy: "Copy", exportDownload: "Download", exportCopied: "Copied to clipboard.", exportCopyFailed: "Copy failed. Use Download instead.", exportEmpty: "Nothing to export.",
  },
  zh: {
    title: "公式编辑器", visual: "可视化", source: "源码", search: "搜索所有公式 ...", preview: "在下方输入 LaTeX", noEditor: "没有活动的编辑器", openEditor: "打开编辑器", editMode: "编辑模式", cancel: "取消", acceptInsert: "插入", acceptUpdate: "更新", ready: "就绪",
    favorites: "收藏", allFormulas: "全部", recent: "最近", pinned: "置顶", hidden: "已隐藏", noResults: "当前视图没有匹配的公式。", drawing: "绘图", drawingTitle: "Mermaid 绘图", drawingInsert: "插入绘图", drawingPreview: "预览", drawingSource: "源码", drawingTemplate: "模板", favHint: "收藏公式以便快速访问", favOnly: "仅显示收藏", clearFavs: "清除所有收藏",
    drawingUndo: "撤销", drawingRedo: "重做", drawingRestoreOriginal: "还原原稿", drawingDraftRestored: "已恢复上次草稿", drawingIncompatible: "无法切换到可视化：源码包含可视化编辑器无法表达的语法，已保留原稿。", drawingUnsupported: "不支持的行", drawingLossless: "当前源码可无损可视化编辑。", drawingTemplateReplaced: "已套用模板，可用撤销恢复原内容。", drawingEditExisting: "编辑该绘图", drawingZoomIn: "放大", drawingZoomOut: "缩小", drawingZoomReset: "重置缩放", drawingFit: "适配视图", drawingExportSvg: "导出 SVG", drawingExportSvgDone: "已导出 SVG", drawingExportSvgFailed: "没有可导出的预览", drawingPanHint: "拖动平移，Ctrl+滚轮缩放",
    paramTemplates: "参数模板", paramTitle: "参数化公式", paramDesc: "填写命名参数，下方 LaTeX 会随输入实时更新。", paramPreset: "参数预设", paramPresetNone: "未保存预设", paramPresetName: "预设名称", paramPresetNameRequired: "请输入预设名称", paramPresetSaved: "预设已保存", paramPresetDeleted: "预设已删除", paramPresetDelete: "删除预设", paramInsert: "插入到笔记", paramUseInEditor: "填入编辑器", paramLatex: "生成的 LaTeX", paramNoTemplates: "没有可用的模板", paramReset: "重置取值", saveToLibrary: "保存到我的公式", saveToLibraryTitle: "保存到我的公式", saveToLibraryGroup: "分类", saveToLibraryNewGroup: "新分类名称（可选）", saveToLibraryNoLatex: "还没有公式可保存，请先输入一个公式", saveToLibrarySaved: "已保存到我的公式", saveToLibraryUpdated: "已更新我的公式中的同名条目", itemTags: "标签", itemTagsPlaceholder: "用逗号或空格分隔，例如 代数, 期末", itemNote: "说明", itemNotePlaceholder: "用途、适用条件或常见变形", saveToLibraryDesc: "名称、标签和说明会随公式存入你自己的文件夹，内置公式库不受影响。", itemNameRequired: "请输入公式名称。", saveToLibraryDefaultGroup: "我的公式",
    matrixPaste: "矩阵数据粘贴", matrixPasteTitle: "从粘贴数据生成矩阵", matrixPasteDesc: "从表格或普通文本粘贴数据，支持制表符、逗号、分号、竖线或空格分隔。", matrixPastePlaceholder: "1\t2\t3\n4\t5\t6", matrixEnv: "环境", matrixDelim: "分隔符", matrixDelimAuto: "自动识别", matrixDelimTab: "制表符", matrixDelimComma: "逗号", matrixDelimSemicolon: "分号", matrixDelimPipe: "竖线", matrixDelimSpace: "空格", matrixSize: "{r} 行 × {c} 列", matrixEmpty: "粘贴数据后即可生成矩阵。", matrixWrapText: "文本单元格包在 \\text{} 中", matrixTranspose: "转置", matrixAddRow: "增加行", matrixRemoveRow: "删除行", matrixAddColumn: "增加列", matrixRemoveColumn: "删除列", matrixCopy: "复制 LaTeX", matrixCopied: "LaTeX 已复制到剪贴板", matrixEnvBmatrix: "方括号 [ ]", matrixEnvPmatrix: "圆括号 ( )", matrixEnvMatrix: "无定界符", matrixEnvVmatrix: "单竖线 | |", matrixEnvVmatrixBig: "双竖线 || ||", matrixEnvArray: "方括号数组", matrixEnvCases: "分段函数", matrixEnvAligned: "对齐公式",
    plotTitle: "函数绘图", plotDesc: "输入表达式绘制 y = f(x)；除 x 外的字母会自动生成滑块。", plotFunctions: "函数", plotAddFunction: "添加函数", plotRemoveFunction: "删除", plotExpressionPlaceholder: "y = a x^2 + b", plotParameters: "参数", plotNoParams: "无参数", plotXMin: "x 最小", plotXMax: "x 最大", plotYMin: "y 最小", plotYMax: "y 最大", plotAutoY: "自动 y", plotTheme: "主题", plotThemeAuto: "跟随主题", plotThemeLight: "浅色", plotThemeDark: "深色", plotFolder: "图片文件夹", plotStatus: "{n} 条曲线 · 参数：{params}", plotParseError: "无法解析", plotNoFunction: "请先输入函数", plotInsertSvg: "插入 SVG", plotInsertFile: "保存图片并嵌入", plotCopySvg: "复制 SVG", plotCopied: "SVG 已复制到剪贴板", plotDownloadSvg: "下载 SVG", plotInserted: "已添加", plotInsertFailed: "插入绘图失败", plotDefinitions: "函数定义", plotDefinitionsHint: "每行一个，例如 f(x) = x^2 + a。定义里可以用滑块参数，也可以调用在它上面已定义的函数。", plotDefinitionsPlaceholder: "f(x) = x^2 + a", plotLocals: "局部常量", plotLocalsPlaceholder: "a=2, b=-1", plotThemeHint: "内联插入会跟随主题；复制、下载与保存图片会按当前主题固定配色。", plotLine: "第 {n} 行", plotDefSyntax: "格式应为 名称(参数) = 表达式", plotDefName: "函数名无效或与内置冲突", plotDefParams: "参数名必须合法且不重复", plotDefBody: "无法解析定义体", plotDefUnknownFunction: "定义中用了未知函数", plotLocalsSyntax: "格式应为 a=2", plotLocalsName: "局部常量名无效", plotLocalsValue: "无法计算该取值", plotLocalsError: "局部常量错误",
    settingsTitle: "Formula Library 设置",
    language: "语言", languageDesc: "界面语言，auto 跟随 Obsidian 设置。",
    insertFormat: "插入格式", insertFormatDesc: "公式插入时的包裹方式。",
    defaultMode: "默认编辑器模式", defaultModeDesc: "打开编辑器时默认可视化或源码。",
    mathliveKbd: "MathLive 虚拟键盘", mathliveKbdDesc: "可视化模式下启用虚拟键盘。",
    formulasFolder: "公式文件夹", formulasFolderDesc: "公式文件相对插件目录的路径。",
    fontSize: "预览字体大小", fontSizeDesc: "MathLive 编辑器字号 (px)。",
    libraryFontFollow: "跟随 Obsidian 字号", libraryFontFollowDesc: "编辑器右侧和侧栏中的公式名称、源码标签及控件跟随「外观 → 字体大小」。不影响 MathLive 预览字号。",
    libraryFontSize: "公式库字体大小", libraryFontSizeDesc: "独立调整公式库文字（14–32 px）。关闭「跟随 Obsidian 字号」后可调整，已打开的公式库即时更新。",
    fontStyle: "数学字体样式", fontStyleDesc: "斜体（默认）或正体渲染。",
    fontFamily: "自定义字体", fontFamilyDesc: "覆盖数学字体，留空使用 KaTeX 默认。",
    density: "公式库密度", densityDesc: "控制公式卡片的尺寸与间距。",
    sortMode: "公式排序", sortModeDesc: "选择分类内公式的排序方式。",
    resultLimit: "搜索结果上限", resultLimitDesc: "限制渲染数量，保持手机端滚动流畅。",
    showLatexLabels: "显示 LaTeX 标签", showLatexLabelsDesc: "在公式名称下显示源码片段。",
    resetHidden: "恢复隐藏公式", resetHiddenDesc: "让全部已隐藏公式重新可见。",
    groupsTitle: "公式分类", groupsDesc: "切换哪些分类可见。放入 JSON 文件后点击刷新。",
    refreshBtn: "刷新", refreshDesc: "检测新公式文件并重新加载。",
    enableAll: "全部启用",
    disableAll: "全部关闭",
    libraryTitle: "公式库来源",
    libraryDesc: "内置公式随插件提供；自定义公式从你自己的文件夹加载，两者独立管理。",
    builtinLibrary: "内置公式库", builtinLibraryDesc: "控制是否使用内置分类。关闭不会删除收藏、置顶、历史记录和分类开关状态。",
    customLibrary: "自定义公式库", customLibraryDesc: "你自己的 JSON 公式文件夹，独立于内置库加载。",
    customPath: "自定义公式文件夹", customPathDesc: "相对笔记库根目录的路径，例如 my-formulas；留空表示不启用。修改后会自动重新加载。",
    customEmpty: "未检测到自定义公式文件。",
    groupsEmpty: "没有可用的内置分类。",
    enableAllGroups: "内置分类批量开关", enableAllGroupsDesc: "一次性开启或关闭全部内置分类。", customSuffix: "自定义",
    shortcuts: "键盘快捷键", shortcutsDesc: "自定义公式插入快捷键（如 ctrl+f, ctrl+shift+f）。",
    shortcutFraction: "分数 (\\frac)", shortcutSqrt: "根号 (\\sqrt)", shortcutSuper: "上标 (^{})", shortcutSub: "下标 (_{})", shortcutSubSuper: "上下标 (_{}^{})",
    confirm: "删除", save: "保存",
    customManage: "管理自定义公式", customManageDesc: "在自己文件夹里新增、编辑、导入和导出公式。",
    manageTitle: "自定义公式", manageNewGroup: "新建分类", manageAddFormula: "新增公式", manageEditFormula: "编辑", manageDeleteFormula: "删除", manageRenameGroup: "重命名", manageDeleteGroup: "删除分类", manageExportGroup: "导出", manageEmpty: "该分类还没有公式。", manageFolder: "文件夹",
    itemName: "名称", itemNameEn: "英文名称（可选）", itemLatex: "LaTeX",
    groupName: "分类名称", groupNameRequired: "请输入分类名称。", groupExists: "该分类已存在。",
    latexNoDollar: "LaTeX 中不要包含 $ 定界符。", latexBraces: "花括号 { } 不匹配。", latexDuplicate: "该公式已存在",
    importTitle: "导入公式", importDesc: "可粘贴 JSON 数组、JSON 备份，或每行「名称<TAB>LaTeX」。", importTarget: "添加到", importNewGroup: "新分类名称", importModeNew: "新建分类", importResult: "已导入", importSkipped: "已跳过", importNothing: "没有可导入的内容。",
    exportTitle: "导出公式", exportAll: "全部自定义公式", exportFormatLines: "纯文本", exportFormatJson: "JSON 备份", exportCopy: "复制", exportDownload: "下载", exportCopied: "已复制到剪贴板。", exportCopyFailed: "复制失败，请改用下载。", exportEmpty: "没有可导出的内容。",
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
  const selected = plugin.settings?.locale || "auto";
  const language = selected === "auto" ? (typeof obsidian.getLanguage === "function" ? obsidian.getLanguage() : navigator.language) : selected;
  return String(language || "en").startsWith("zh") ? "zh" : "en";
}
function ui(plugin, key) {
  const lang = loc(plugin);
  return (UI_STRINGS[lang] && UI_STRINGS[lang][key]) || UI_STRINGS.en[key] || key;
}
function tabName(plugin, g) {
  const strings = (FORMULA_DATA && FORMULA_DATA.STRINGS) || bundledStrings();
  const tabs = ((strings[loc(plugin)] || strings.en || {}).tabs) || {};
  return tabs[g.id] || g.id;
}
// Localized group name looked up by id, so groups that are switched off (and
// therefore absent from FORMULA_DATA.GROUPS) can still be listed in settings.
function groupDisplayName(plugin, id) {
  const strings = FORMULA_INDEX.strings || bundledStrings();
  const tabs = ((strings[loc(plugin)] || strings.en || {}).tabs) || {};
  return tabs[id] || id;
}
function groupSourceSuffix(plugin, g) {
  return g && g.source === "custom" ? " · " + ui(plugin, "customSuffix") : "";
}
function itemLabel(plugin, i) {
  return loc(plugin) === "zh" ? i[0] : (i[2] || i[0]);
}

// Personal-library entries may carry a 4th element with the fields the formula
// table cannot express: `{ tags: [...], note: "..." }`. Built-in items never
// have it, and the array shape stays valid for every older reader.
function itemMeta(item) {
  const meta = item && item[3];
  return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
}

function itemTags(item) {
  const meta = itemMeta(item);
  if (!meta || !Array.isArray(meta.tags)) return [];
  return meta.tags.filter(function(tag) { return typeof tag === "string" && tag.trim(); }).map(function(tag) { return tag.trim(); });
}

function itemNote(item) {
  const meta = itemMeta(item);
  return meta && typeof meta.note === "string" ? meta.note : "";
}

const ITEM_TAG_LIMIT = 8;
const ITEM_TAG_LENGTH = 24;

// "代数, 期末 exam" -> ["代数", "期末", "exam"] (case-insensitive dedupe, capped).
function parseTagsInput(value) {
  const parts = String(value == null ? "" : value).split(/[,;\uFF0C\uFF1B\s]+/);
  const seen = new Set();
  const tags = [];
  for (const part of parts) {
    const tag = part.replace(/^#+/, "").trim().slice(0, ITEM_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= ITEM_TAG_LIMIT) break;
  }
  return tags;
}

function formatTags(tags) {
  return (tags || []).map(function(tag) { return "#" + tag; }).join(" ");
}

// Returns `item` with the metadata attached, or a plain table entry when both
// fields are empty. A missing English label becomes "" instead of a hole so the
// JSON stays a clean rectangular array.
function withItemMeta(item, tags, note, details) {
  const entry = [item[0] == null ? "" : item[0], item[1] == null ? "" : item[1]];
  if (item[2]) entry[2] = item[2];
  const list = tags && tags.length ? tags.slice() : [];
  const text = String(note == null ? "" : note).trim();
  const extra = {};
  for (const key of ["variables", "units", "conditions", "reference"]) {
    const value = details?.[key] ?? itemMeta(item)?.[key];
    if (typeof value === "string" && value.trim()) extra[key] = value.trim().slice(0, 5000);
  }
  if (list.length || text || Object.keys(extra).length) {
    if (entry.length === 2) entry[2] = "";
    const meta = { ...extra, tags: list };
    if (text) meta.note = text;
    entry[3] = meta;
  }
  return entry;
}

function trackUsage(plugin, latex) {
  if (!latex) return;
  const counts = plugin.settings.usageCounts || {};
  counts[latex] = (counts[latex] || 0) + 1;
  plugin.settings.usageCounts = counts;
  const recent = (plugin.settings.recentFormulas || []).filter(function(value) { return value !== latex; });
  recent.unshift(latex);
  plugin.settings.recentFormulas = recent.slice(0, 80);
  plugin.saveSettings();
}

function getUsageCount(plugin, latex) {
  return (plugin.settings.usageCounts || {})[latex] || 0;
}

function isFavorite(plugin, latex) {
  return (plugin.settings.favorites || []).indexOf(latex) >= 0;
}

function toggleFavorite(plugin, latex) {
  const favs = plugin.settings.favorites || [];
  const idx = favs.indexOf(latex);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(latex);
  }
  plugin.settings.favorites = favs;
  plugin.saveSettings();
}

function sortByUsage(plugin, items) {
  const counts = plugin.settings.usageCounts || {};
  const favs = plugin.settings.favorites || [];
  const pinned = plugin.settings.pinnedFormulas || [];
  const recent = plugin.settings.recentFormulas || [];
  const mode = plugin.settings.librarySort || "smart";
  return items.slice().sort(function(a, b) {
    const pa = pinned.indexOf(a[1]) >= 0 ? 1 : 0;
    const pb = pinned.indexOf(b[1]) >= 0 ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (mode === "alphabetical") return String(a[0]).localeCompare(String(b[0]), loc(plugin) === "zh" ? "zh-CN" : "en");
    if (mode === "recent") {
      const ar = recent.indexOf(a[1]);
      const br = recent.indexOf(b[1]);
      if (ar !== br) return (ar < 0 ? Number.MAX_SAFE_INTEGER : ar) - (br < 0 ? Number.MAX_SAFE_INTEGER : br);
    }
    const fa = favs.indexOf(a[1]) >= 0 ? 1 : 0;
    const fb = favs.indexOf(b[1]) >= 0 ? 1 : 0;
    if (mode === "smart" && fa !== fb) return fb - fa;
    const ca = counts[b[1]] || 0;
    const cb = counts[a[1]] || 0;
    return ca - cb;
  });
}

function filterByFavorites(plugin, items) {
  const favs = plugin.settings.favorites || [];
  return items.filter(function(i) { return favs.indexOf(i[1]) >= 0; });
}

function toggleFormulaSetting(plugin, key, latex) {
  const values = Array.isArray(plugin.settings[key]) ? plugin.settings[key].slice() : [];
  const index = values.indexOf(latex);
  if (index >= 0) values.splice(index, 1);
  else values.push(latex);
  plugin.settings[key] = values;
  plugin.saveSettings();
}

function isPinned(plugin, latex) {
  return (plugin.settings.pinnedFormulas || []).includes(latex);
}

function isHidden(plugin, latex) {
  return (plugin.settings.hiddenFormulas || []).includes(latex);
}

function isRecent(plugin, latex) {
  return (plugin.settings.recentFormulas || []).includes(latex);
}

function formulaMatchesView(plugin, item, view) {
  const latex = item[1];
  if (view === "hidden") return isHidden(plugin, latex);
  if (isHidden(plugin, latex)) return false;
  if (view === "favorites") return isFavorite(plugin, latex);
  if (view === "pinned") return isPinned(plugin, latex);
  if (view === "recent") return isRecent(plugin, latex);
  return true;
}

function createLibraryFilterBar(plugin, parent, initialView, onChange) {
  const controls = parent.createDiv({ cls: "fl-filter-bar", attr: { role: "group", "aria-label": loc(plugin) === "zh" ? "公式筛选" : "Formula filters" } });
  const buttons = new Map();
  const definitions = [
    ["all", "list-filter", ui(plugin, "allFormulas")],
    ["favorites", "star", ui(plugin, "favorites")],
    ["pinned", "pin", ui(plugin, "pinned")],
    ["recent", "history", ui(plugin, "recent")],
    ["hidden", "eye-off", ui(plugin, "hidden")],
  ];
  const setActive = function(view) {
    for (const [key, button] of buttons.entries()) button.toggleClass("active", key === view);
  };
  for (const [key, icon, label] of definitions) {
    const button = controls.createEl("button", { cls: "fl-filter-btn", attr: { type: "button", title: label, "aria-label": label } });
    obsidian.setIcon(button, icon);
    button.createSpan({ text: label, cls: "fl-filter-label" });
    button.addEventListener("click", () => {
      setActive(key);
      onChange(key);
    });
    buttons.set(key, button);
  }
  setActive(initialView || "all");
  const refreshLabels = (currentPlugin = plugin) => {
    controls.setAttribute("aria-label", loc(currentPlugin) === "zh" ? "公式筛选" : "Formula filters");
    const keys = { all: "allFormulas", favorites: "favorites", pinned: "pinned", recent: "recent", hidden: "hidden" };
    for (const [key, button] of buttons) {
      const label = ui(currentPlugin, keys[key]);
      button.title = label;
      button.setAttribute("aria-label", label);
      button.querySelector(".fl-filter-label").textContent = label;
    }
  };
  return { controls, setActive, refreshLabels };
}

function openFormulaMenu(plugin, item, event, refresh) {
  const latex = item[1];
  const menu = new obsidian.Menu();
  if (plugin.openFormulaDetails) menu.addItem((entry) => entry
    .setTitle(loc(plugin) === "zh" ? "公式详情" : "Formula details")
    .setIcon("info").onClick(() => plugin.openFormulaDetails(item)));
  menu.addItem((entry) => entry
    .setTitle(isFavorite(plugin, latex) ? (loc(plugin) === "zh" ? "取消收藏" : "Remove favorite") : ui(plugin, "favorites"))
    .setIcon("star")
    .onClick(() => { toggleFavorite(plugin, latex); refresh(); }));
  menu.addItem((entry) => entry
    .setTitle(isPinned(plugin, latex) ? (loc(plugin) === "zh" ? "取消置顶" : "Unpin") : ui(plugin, "pinned"))
    .setIcon("pin")
    .onClick(() => { toggleFormulaSetting(plugin, "pinnedFormulas", latex); refresh(); }));
  menu.addSeparator();
  menu.addItem((entry) => entry
    .setTitle(loc(plugin) === "zh" ? "复制 LaTeX" : "Copy LaTeX")
    .setIcon("copy")
    .onClick(async () => {
      try {
        await navigator.clipboard.writeText(latex);
        new obsidian.Notice(loc(plugin) === "zh" ? "已复制 LaTeX" : "LaTeX copied");
      } catch (error) {
        logWarn("copy LaTeX failed:", error instanceof Error ? error.message : String(error));
        new obsidian.Notice(loc(plugin) === "zh" ? "复制失败" : "Copy failed");
      }
    }));
  menu.addItem((entry) => entry
    .setTitle(isHidden(plugin, latex) ? (loc(plugin) === "zh" ? "取消隐藏" : "Unhide") : (loc(plugin) === "zh" ? "隐藏公式" : "Hide formula"))
    .setIcon(isHidden(plugin, latex) ? "eye" : "eye-off")
    .onClick(() => { toggleFormulaSetting(plugin, "hiddenFormulas", latex); refresh(); }));
  if (event.clientX || event.clientY) menu.showAtMouseEvent(event);
  else {
    const rect = event.currentTarget?.getBoundingClientRect();
    menu.showAtPosition({ x: rect?.left || 0, y: rect?.bottom || 0 });
  }
}



function pinyinInitials(str) {
  const map = PINYIN_INITIALS;
  let r = "";
  for (const ch of str) { if (map[ch]) r += map[ch]; }
  return r;
}

// ---------------------------------------------------------------- search rank
// Relevance tiers: an exact name or command beats prefixes, which beat
// substrings, pinyin, aliases and finally fuzzy matches. Ties fall back to
// pins, favorites and usage counts so the previous ordering still shows.
const SEARCH_RANK = {
  labelExact: 1000,
  latexExact: 950,
  commandExact: 930,
  enExact: 900,
  labelPrefix: 800,
  enPrefix: 780,
  commandPrefix: 760,
  latexPrefix: 740,
  pinyinExact: 700,
  pinyinPrefix: 620,
  labelContains: 600,
  enContains: 560,
  latexContains: 540,
  pinyinContains: 520,
  tagExact: 505,
  tagPrefix: 498,
  tagContains: 492,
  noteContains: 490,
  alias: 400,
  enWord: 360,
  aliasWord: 340,
  abbrev: 320,
  subsequence: 200,
};

// "\frac{a}{b}" -> "frac"
function latexCommandOf(latex) {
  const match = /^[^a-zA-Z]*([a-zA-Z]+)/.exec(String(latex == null ? "" : latex));
  return match ? match[1].toLowerCase() : "";
}

// 0 means "no match"; a higher value is a better match.
function searchRank(plugin, query, item) {
  const q = String(query == null ? "" : query).toLowerCase().trim();
  if (!q || !item) return 0;
  const label = String(itemLabel(plugin, item) || "").toLowerCase();
  const rawLabel = String(item[0] == null ? "" : item[0]).toLowerCase();
  const latex = String(item[1] == null ? "" : item[1]).toLowerCase();
  const enLabel = String(item[2] == null ? "" : item[2]).toLowerCase();
  const compact = q.replace(/[\\{}\s$]/g, "");
  const latexCompact = latex.replace(/[\\{}\s$]/g, "");
  const command = latexCommandOf(latex);
  let rank = 0;
  const bump = function(value) { if (value > rank) rank = value; };

  if (label === q || rawLabel === q) bump(SEARCH_RANK.labelExact);
  if (latex === q || (compact.length >= 2 && latexCompact === compact)) bump(SEARCH_RANK.latexExact);
  if (command && compact && command === compact) bump(SEARCH_RANK.commandExact);
  if (enLabel && enLabel === q) bump(SEARCH_RANK.enExact);

  if (label.startsWith(q) || rawLabel.startsWith(q)) bump(SEARCH_RANK.labelPrefix);
  if (enLabel && enLabel.startsWith(q)) bump(SEARCH_RANK.enPrefix);
  if (command && compact && command.startsWith(compact)) bump(SEARCH_RANK.commandPrefix);
  if (latex.startsWith(q) || latex.startsWith("\\" + q)) bump(SEARCH_RANK.latexPrefix);

  // Pinyin initials (Chinese users): `fs`, `jz`, `wl` match Chinese labels.
  const pinyin = pinyinInitials(item[0] || "");
  const pinyinQuery = q.replace(/[^a-z]/g, "");
  if (pinyinQuery.length >= 2 && pinyin) {
    if (pinyin === pinyinQuery) bump(SEARCH_RANK.pinyinExact);
    else if (pinyin.startsWith(pinyinQuery)) bump(SEARCH_RANK.pinyinPrefix);
    if (pinyin.includes(pinyinQuery)) bump(SEARCH_RANK.pinyinContains);
  }

  if (label.includes(q) || rawLabel.includes(q)) bump(SEARCH_RANK.labelContains);
  if (enLabel && enLabel.includes(q)) bump(SEARCH_RANK.enContains);
  if (latex.includes(q) || (compact.length >= 2 && latexCompact.includes(compact))) bump(SEARCH_RANK.latexContains);

  // Personal-library tags and notes: "#trig" or "exam" both reach the entry.
  const tags = itemTags(item);
  if (tags.length) {
    const tagQuery = q.replace(/^#+/, "").trim();
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (!tagQuery) break;
      if (lower === tagQuery) bump(SEARCH_RANK.tagExact);
      else if (lower.startsWith(tagQuery)) bump(SEARCH_RANK.tagPrefix);
      else if (lower.includes(tagQuery)) bump(SEARCH_RANK.tagContains);
    }
  }
  const note = [itemNote(item), ...["variables", "units", "conditions", "reference"].map((key) => itemMeta(item)?.[key] || "")].join(" ").toLowerCase();
  if (note && note.includes(q)) bump(SEARCH_RANK.noteContains);

  // Command aliases: "less equal" or "lte" also reach the formulas listed
  // under that command.
  for (const [cmd, aliases] of Object.entries(SEARCH_ALIASES)) {
    if (!(q.includes(cmd) || cmd.includes(q))) continue;
    for (const alias of aliases) {
      const text = String(alias).toLowerCase();
      if (label.includes(text) || rawLabel.includes(text) || enLabel.includes(text) || latex.includes("\\" + cmd)) {
        bump(SEARCH_RANK.alias);
        break;
      }
    }
  }

  // Word-based matching: every query word has to prefix a label word.
  const words = q.split(/\s+/).filter(function(word) { return word.length >= 2; });
  const matchesAllWords = function(candidate) {
    const parts = candidate.split(/\s+/);
    const hits = words.filter(function(word) {
      return parts.some(function(part) { return part.startsWith(word) || word.startsWith(part); });
    }).length;
    return hits === words.length;
  };
  if (words.length >= 2) {
    if (enLabel && matchesAllWords(enLabel)) bump(SEARCH_RANK.enWord);
    for (const aliases of Object.values(SEARCH_ALIASES)) {
      if (matchesAllWords(aliases.join(" ").toLowerCase())) { bump(SEARCH_RANK.aliasWord); break; }
    }
  }

  // Initials: "lte" matches "less than or equal".
  if (q.length >= 3) {
    const initialsQuery = q.replace(/[^a-z]/g, "");
    if (initialsQuery.length >= 3) {
      for (const aliases of Object.values(SEARCH_ALIASES)) {
        const initials = aliases.join(" ").toLowerCase().split(/\s+/).map(function(word) { return word[0]; }).join("");
        if (initials && (initials.includes(initialsQuery) || initialsQuery.includes(initials))) {
          bump(SEARCH_RANK.abbrev);
          break;
        }
      }
    }
  }

  // Last resort: subsequence match ("qt" for "quadratic").
  if (q.length >= 2) {
    const subsequence = function(text) {
      let index = 0;
      for (let i = 0; i < text.length && index < q.length; i++) {
        if (text[i] === q[index]) index++;
      }
      return index === q.length;
    };
    if (subsequence(label) || subsequence(rawLabel) || (enLabel && subsequence(enLabel))) bump(SEARCH_RANK.subsequence);
  }

  return rank;
}

// Ranked search across every enabled group. The full result set is returned so
// callers can show a total count and load more without truncating a category.
function searchLibrary(plugin, query, viewMode) {
  const results = [];
  if (!FORMULA_DATA || !FORMULA_DATA.GROUPS) return results;
  const q = String(query == null ? "" : query).trim();
  if (!q) return results;
  const counts = plugin.settings.usageCounts || {};
  const favorites = plugin.settings.favorites || [];
  const pinned = plugin.settings.pinnedFormulas || [];

  FORMULA_DATA.GROUPS.forEach(function(group, groupIndex) {
    group.items.forEach(function(item, itemIndex) {
      if (!item || item.section) return;
      if (!formulaMatchesView(plugin, item, viewMode)) return;
      const rank = searchRank(plugin, q, item);
      if (rank <= 0) return;
      results.push({ item: item, group: group, groupIndex: groupIndex, itemIndex: itemIndex, rank: rank });
    });
  });

  results.sort(function(a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    const pinA = pinned.indexOf(a.item[1]) >= 0 ? 1 : 0;
    const pinB = pinned.indexOf(b.item[1]) >= 0 ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    const favA = favorites.indexOf(a.item[1]) >= 0 ? 1 : 0;
    const favB = favorites.indexOf(b.item[1]) >= 0 ? 1 : 0;
    if (favA !== favB) return favB - favA;
    const countA = counts[a.item[1]] || 0;
    const countB = counts[b.item[1]] || 0;
    if (countA !== countB) return countB - countA;
    const labelA = String(a.item[0] == null ? "" : a.item[0]).length;
    const labelB = String(b.item[0] == null ? "" : b.item[0]).length;
    if (labelA !== labelB) return labelA - labelB;
    if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex;
    return a.itemIndex - b.itemIndex;
  });

  return results;
}

// "N matches · showing M", shared by the sidebar and the editor modal.
function searchSummaryText(plugin, total, shown) {
  const zh = loc(plugin) === "zh";
  if (!total) return "";
  if (total <= shown) return zh ? "匹配 " + total + " 条" : total + (total === 1 ? " match" : " matches");
  return zh ? "匹配 " + total + " 条 · 已显示 " + shown + " 条" : total + " matches · showing " + shown;
}

function searchMoreText(plugin, remaining) {
  return loc(plugin) === "zh" ? "显示更多（还有 " + remaining + " 条）" : "Show more (" + remaining + " left)";
}




// Inventory of everything the library could load, including switched-off groups.
// The settings tab reads this so categories stay manageable even when no
// formulas/ folder exists and the embedded library is in use.
const FORMULA_INDEX = {
  builtin: [],
  custom: [],
  strings: null,
  origin: "none",
  folder: null,
  customFolder: "",
  errors: [],
};

function bundledGroupList() {
  if (BUNDLED_FALLBACK && Array.isArray(BUNDLED_FALLBACK.GROUPS)) return BUNDLED_FALLBACK.GROUPS;
  return [];
}

function bundledStrings() {
  if (BUNDLED_FALLBACK && BUNDLED_FALLBACK.STRINGS) return BUNDLED_FALLBACK.STRINGS;
  return { en: { tabs: {} }, zh: { tabs: {} } };
}

function fileNameOf(filePath) {
  const parts = String(filePath == null ? "" : filePath).split(/[\\\/]/);
  return parts[parts.length - 1] || "";
}

// Folder paths come from a settings text box: surrounding whitespace and
// leading/trailing separators are tolerated and removed.
function normalizeFolderPath(value) {
  return String(value == null ? "" : value).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

// Merges tab names, preferring the second argument (used to let a custom
// _strings.json override the built-in names).
function mergeStrings(base, extra) {
  if (!extra) return base;
  const out = {};
  const baseObj = base || {};
  for (const lang of ["en", "zh"]) {
    const fromBase = baseObj[lang] || {};
    const fromExtra = extra[lang] || {};
    const merged = Object.assign({}, fromBase, fromExtra);
    merged.tabs = Object.assign({}, fromBase.tabs || {}, fromExtra.tabs || {});
    out[lang] = merged;
  }
  return out;
}

// Reads every group file of one folder. A single broken file never aborts the
// whole load: the failure is collected into `errors` for the settings tab.
async function readFormulaFolder(adapter, folder, errors, source) {
  const result = { groups: [], strings: null };
  if (!adapter || !folder) return result;

  try {
    result.strings = JSON.parse(await adapter.read(folder + "/_strings.json"));
  } catch {
    // Optional file: group ids are used as-is when tab names are missing.
  }

  let fileNames = [];
  try {
    const order = JSON.parse(await adapter.read(folder + "/_index.json")).order;
    if (Array.isArray(order) && order.length) {
      fileNames = order.map(function(id) { return id + ".json"; });
    }
  } catch {
    // No _index.json: auto-discover group files below.
  }

  {
    const listing = await adapter.list(folder);
    const discovered = (listing.files || [])
      .map(fileNameOf)
      .filter(function(name) { return name.endsWith(".json") && !name.startsWith("_"); });
    discovered.sort();
    fileNames = [...new Set([...fileNames, ...discovered])];
  }

  for (const fileName of fileNames) {
    try {
      const group = JSON.parse(await adapter.read(folder + "/" + fileName));
      if (group && group.id && Array.isArray(group.items)) {
        const items = group.items.filter((item) => (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string") || (item && typeof item.section === "string"));
        if (items.length !== group.items.length) errors.push(source + "/" + fileName + ": skipped invalid entries");
        result.groups.push(Object.assign({}, group, { items, source: source, file: fileName }));
      } else {
        errors.push(source + "/" + fileName + ": missing id or items[]");
      }
    } catch (e) {
      errors.push(source + "/" + fileName + ": " + e.message);
    }
  }
  return result;
}

// Built-in library: the formulas folder next to the plugin when it exists and
// yields at least one group, otherwise the copy embedded in main.js.
async function resolveBuiltinLibrary(plugin, errors) {
  const folder = ".obsidian/plugins/" + plugin.manifest.id + "/" + (plugin.settings.formulasPath || "formulas");
  let disk = { groups: [], strings: null };
  try {
    disk = await readFormulaFolder(plugin.app.vault.adapter, folder, errors, "builtin");
  } catch (e) {
    log("Cannot read " + folder + " (" + e.message + "), using the embedded library");
  }
  if (disk.groups.length) {
    return { groups: disk.groups, strings: disk.strings, origin: "folder", folder: folder };
  }
  const bundled = bundledGroupList();
  if (!bundled.length) {
    logErr("No formula data available");
    return { groups: [], strings: disk.strings, origin: "none", folder: folder };
  }
  log("Using embedded library,", bundled.length, "groups");
  return { groups: bundled, strings: mergeStrings(bundledStrings(), disk.strings), origin: "bundled", folder: null };
}

// Custom library: a vault-relative folder, loaded independently of the built-in
// library and of its master switch.
async function resolveCustomLibrary(plugin, errors) {
  const raw = normalizeFolderPath(plugin.settings.customFormulasPath);
  if (!raw) return { groups: [], strings: null, folder: "" };
  try {
    const result = await readFormulaFolder(plugin.app.vault.adapter, raw, errors, "custom");
    return { groups: result.groups, strings: result.strings, folder: raw };
  } catch (e) {
    errors.push(raw + ": " + e.message);
    return { groups: [], strings: null, folder: raw };
  }
}

async function loadFormulas(plugin) {
  const settings = plugin.settings || {};
  const errors = [];
  const builtinEnabled = settings.builtinLibraryEnabled !== false;
  const enabledGroups = settings.enabledGroups || {};
  const customEnabledGroups = settings.customEnabledGroups || {};

  let builtin = { groups: [], strings: null, origin: "none", folder: null };
  let custom = { groups: [], strings: null, folder: "" };
  try {
    builtin = await resolveBuiltinLibrary(plugin, errors);
  } catch (e) {
    errors.push("builtin: " + e.message);
  }
  try {
    custom = await resolveCustomLibrary(plugin, errors);
  } catch (e) {
    errors.push("custom: " + e.message);
  }

  FORMULA_INDEX.builtin = builtin.groups.map(function(g) {
    return { id: g.id, count: g.items.filter((item) => Array.isArray(item)).length, file: g.file || g.id + ".json", source: "builtin" };
  });
  FORMULA_INDEX.custom = custom.groups.map(function(g) {
    return { id: g.id, count: g.items.filter((item) => Array.isArray(item)).length, file: g.file || g.id + ".json", source: "custom" };
  });
  // Built-in names first, then the custom _strings.json on top: a custom group
  // keeps its own localized tab name instead of falling back to its file id.
  FORMULA_INDEX.strings = mergeStrings(builtin.strings || bundledStrings(), custom.strings);
  FORMULA_INDEX.origin = builtin.origin;
  FORMULA_INDEX.folder = builtin.folder;
  FORMULA_INDEX.customFolder = custom.folder;
  FORMULA_INDEX.errors = errors;

  const GROUPS = [];
  if (builtinEnabled) {
    for (const group of builtin.groups) {
      if (enabledGroups[group.id] === false) {
        log("Skipped disabled builtin group:", group.id);
        continue;
      }
      GROUPS.push(Object.assign({}, group, { source: "builtin" }));
    }
  } else {
    log("Builtin library disabled by user");
  }
  for (const group of custom.groups) {
    if (customEnabledGroups[group.id] === false) {
      log("Skipped disabled custom group:", group.id);
      continue;
    }
    GROUPS.push(Object.assign({}, group, { source: "custom" }));
  }

  // loadFormulas never writes settings: an empty library must not switch the
  // built-in library back on by itself.
  FORMULA_DATA = { STRINGS: FORMULA_INDEX.strings, GROUPS: GROUPS, INDEX: FORMULA_INDEX };
  log("Loaded " + GROUPS.length + " groups (builtin origin: " + builtin.origin + ", custom groups: " + custom.groups.length + ")");
  return true;
}

export { FORMULA_DATA, DEFAULT_SETTINGS, LOG_PREFIX, UI_STRINGS, MATHLIVE_ZH, log, logWarn, logErr, loc, ui, tabName, groupDisplayName, groupSourceSuffix, itemLabel, itemMeta, itemTags, itemNote, ITEM_TAG_LIMIT, ITEM_TAG_LENGTH, parseTagsInput, formatTags, withItemMeta, trackUsage, getUsageCount, isFavorite, toggleFavorite, sortByUsage, filterByFavorites, toggleFormulaSetting, isPinned, isHidden, isRecent, formulaMatchesView, createLibraryFilterBar, openFormulaMenu, SEARCH_ALIASES, pinyinInitials, SEARCH_RANK, latexCommandOf, searchRank, searchLibrary, searchSummaryText, searchMoreText, FORMULA_INDEX, bundledGroupList, bundledStrings, fileNameOf, normalizeFolderPath, mergeStrings, readFormulaFolder, resolveBuiltinLibrary, resolveCustomLibrary, loadFormulas };
