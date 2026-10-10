// Tool entry preferences are independent of saved content and library switches.
export const TOOL_DEFINITIONS = Object.freeze([
  { id: "conversion", zh: "格式转换", en: "Format conversion", zhDesc: "显示本地公式转换入口。关闭会停止转换任务并释放引擎，不影响普通 LaTeX 编辑。", enDesc: "Show local formula conversion. Disabling stops conversion tasks and releases the engine; ordinary LaTeX editing is unaffected." },
  { id: "templates", zh: "参数模板", en: "Parameterized templates", zhDesc: "显示模板工具和命令；关闭不会删除自定义模板或参数预设。", enDesc: "Show template tools and commands without deleting personal templates or parameter presets." },
  { id: "matrix", zh: "矩阵数据粘贴", en: "Matrix data paste", zhDesc: "显示从表格或文本生成 LaTeX 矩阵的工具和命令。", enDesc: "Show tools and commands for creating LaTeX matrices from tables or text." },
  { id: "saveToLibrary", zh: "保存到我的公式", en: "Save to my library", zhDesc: "显示编辑器中的保存按钮；个人公式库及设置中的分类管理仍可使用。", enDesc: "Show the editor save button. Your personal library and category management remain available." },
  { id: "plot", zh: "函数绘图", en: "Function plotting", zhDesc: "显示函数绘图工具和编辑命令；保留已有图像、草稿和预设。", enDesc: "Show function plotting tools and edit commands while retaining images, drafts and presets." },
  { id: "mermaid", zh: "Mermaid 绘图", en: "Mermaid diagrams", zhDesc: "显示侧栏绘图按钮、命令和上下文菜单；笔记中的绘图不受影响。", enDesc: "Show the sidebar diagram button, commands and context menu without changing diagrams in notes." },
]);
export const DEFAULT_ENABLED_TOOLS = Object.freeze(Object.fromEntries(TOOL_DEFINITIONS.map(({ id }) => [id, true])));

export function normalizeEnabledTools(value) {
  const map = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(TOOL_DEFINITIONS.map(({ id }) => [id, !Object.hasOwn(map, id) || map[id] !== false]));
}

export function isToolEnabled(plugin, id) {
  if (!Object.hasOwn(DEFAULT_ENABLED_TOOLS, id)) return false;
  const map = plugin?.settings?.enabledTools;
  return !map || !Object.hasOwn(map, id) || map[id] !== false;
}
