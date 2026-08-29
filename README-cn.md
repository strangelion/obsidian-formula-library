# Formula Library - Obsidian Plugin

中文文档 | [English Doc](README.md)

响应式 LaTeX 与 Mermaid 编辑器，支持 **MathLive WYSIWYG 可视化编辑**、**2216 条分类公式**、**智能搜索**（拼音、LaTeX 命令、模糊匹配），以及**可扩展的公式文件夹**供用户自定义。

## 功能

- **MathLive 可视化编辑器**：WYSIWYG 公式编辑，实时预览 + 虚拟键盘
- **2216 条公式**：19 个分类，新增 95 条算法、图论、信息论、机器学习、图形学、信号和数值计算公式
- **智能搜索**：拼音首字母、LaTeX 命令别名、英文单词匹配、缩写匹配（如 `lt` → less than）、模糊匹配
- **使用频率排序**：常用公式自动排在前面——搜索结果和分类列表按插入次数排序
- **公式控制**：支持收藏、置顶、最近使用、隐藏、复制，以及智能/次数/最近/名称排序、卡片密度和结果上限
- **Mermaid 绘图**：11 种模板；流程图和状态图支持节点/连线可视化编辑，所有图型支持源码、居中预览和 Markdown 插入
- **可配置快捷键**：自定义分数、根号、上标、下标快捷键（默认未绑定）
- **矩阵模板**：支持 cases、matrix、bmatrix、pmatrix、jacobian、hessian、identity、diagonal、augmented 等
- **Visual / Source 模式**：可视化编辑与 LaTeX 源码切换
- **编辑已有公式**：光标放在 `$...$` 或 `$$...$$` 内，运行命令即可编辑
- **侧边栏快速插入**：左侧边栏直接点击插入公式
- **分类下拉框**：分类选择器改为下拉菜单，侧边栏更紧凑
- **设置页面**：语言、插入格式、编辑器模式、快捷键、字体、密度、排序、结果上限、LaTeX 标签和公式分类开关
- **可扩展公式文件夹**：在 `formulas/` 中放入 JSON 文件即可添加自定义公式分类
- **中英文双语**：跟随 Obsidian 语言设置自动切换

## 安装

### 手动安装
1. 将 `obsidian-formula-library` 文件夹复制到你的 Vault 的 `.obsidian/plugins/` 目录
2. 在 Obsidian 设置 > 社区插件中启用
3. （可选）在设置 > 快捷键中为 "Open Formula Editor" 设置快捷键

### BRAT 安装
1. 在 Obsidian 中安装 BRAT 插件
2. 打开 BRAT 设置，点击 "Add Beta plugin"
3. 输入仓库地址：`obsidian-formula-library`（确保 release 中包含 `formulas/` 文件夹）
4. 安装后重启 Obsidian

## 使用

### 公式编辑器
- **命令面板**：`Ctrl+P` → "Open Formula Editor"
- **侧边栏图标**：点击左侧 Σ 图标
- 弹窗打开后，右侧选择公式分类，点击公式插入到编辑器
- 点击 **插入**（或 `Shift+Enter`）将公式写入笔记

### Mermaid 绘图编辑器
- **命令面板**：`Ctrl+P` → "Open Mermaid Diagram Editor"
- 流程图和状态图可在 **可视化 / 源码** 间切换，直接增删节点、连线并修改方向、形状和文字
- 内置流程图、思维导图、时序图、状态图、类图、ER 图、甘特图、时间线、饼图、象限图和 Git 分支图模板
- 如果已安装 Excalidraw，工具栏会显示快捷入口，用于自由手绘和形状拖拽
- 点击 **插入绘图**（或 `Shift+Enter`）插入原生 Mermaid 代码块

### 侧边栏快速插入
- 点击 Σ 图标切换侧边栏
- 用下拉框切换分类
- 点击 ☆ 收藏公式，点击 ★ 取消收藏
- 点击公式直接插入到当前光标位置
- 每个分类内常用公式自动排在前面

### 编辑已有公式
- 光标放在 `$...$` 或 `$$...$$` 内
- 运行命令 "Edit Formula at Cursor"
- 修改后点击 **更新**

## 公式分类

| 分类 | 数量 | 说明 |
|------|------|------|
| 希腊字母 | 52 | α, β, γ, ... |
| 结构 | 43 | 分数、根号、积分、求和、矩阵 |
| 分隔符 | 36 | 括号、方括号、花括号、绝对值 |
| 分析 | 210 | 实分析、复分析、泛函分析、测度论 |
| 代数 | 174 | 线性代数、群论/环论/模论、同调代数 |
| 几何 | 133 | 经典几何、微分几何、黎曼几何、辛几何 |
| 拓扑 | 166 | 点集拓扑、代数拓扑、微分拓扑 |
| 数论 | 166 | 初等数论、解析数论、代数数论、模形式 |
| 关系 | 112 | 等式、序关系、子集、逻辑关系 |
| 运算 | 64 | 算术、集合、逻辑运算符 |
| 大型运算符 | 20 | 求和、求积、积分、并集、交集 |
| 箭头 | 68 | 各类箭头符号 |
| 集合 | 40 | 集合论、逻辑、基数 |
| 函数 | 131 | 初等函数、特殊函数、分布 |
| 概率 | 170 | 分布、定理、随机过程 |
| 计算 | 95 | 算法、图论、信息论、机器学习、图形学、信号、数值计算 |
| 物理 | 251 | 力学、电磁学、量子、相对论、QFT |
| 化学 | 229 | 反应、分子、离子、热力学 |
| 杂项 | 56 | 省略号、无穷大、特殊符号 |

## 自定义公式

公式数据存储在插件目录的 `formulas/` 文件夹中，每个分类一个 JSON 文件。用户可以直接添加新公式或新分类。

> **BRAT 兼容性**：插件包含 `_bundled.js` 作为备用数据。如果 `formulas/` 文件夹无法加载，插件会自动使用备用数据。确保发布 release 时包含整个 `formulas/` 文件夹。

### 文件结构

```
formulas/
  _index.json          # 分类排序（可选，不存在则自动发现）
  _strings.json        # UI 翻译文本
  greek.json           # 希腊字母
  structures.json      # 结构
  analysis.json        # 分析
  ...                  # 其他分类
```

### 添加新公式到已有分类

编辑对应分类的 JSON 文件，在 `items` 数组中添加新公式：

```json
{
  "id": "greek",
  "structures": false,
  "items": [
    ["α", "\\alpha"],
    ["β", "\\beta"],
    ["自定义公式", "\\mycommand{#?}", "Custom Formula"]
  ]
}
```

### 添加新分类

1. 在 `formulas/` 目录下创建新的 JSON 文件（如 `mycategory.json`）：

```json
{
  "id": "mycategory",
  "structures": false,
  "items": [
    ["公式名称", "\\latex{code}", "English Name"]
  ]
}
```

2. 在 `_index.json` 的 `order` 数组中添加新分类的 ID：

```json
{
  "order": ["greek", "structures", "...", "mycategory"]
}
```

> 如果 `_index.json` 不存在或不包含新分类 ID，插件会自动发现并按字母顺序加载。

### 公式格式

每个公式是数组格式：`[中文标签, LaTeX 代码, 英文标签（可选）]`

- **简单公式**：`["α", "\\alpha"]`
- **带英文标签**：`["分数", "\\frac{#?}{#?}", "Fraction"]`
- **分段标记**：`{"section": "分节标题", "sectionEn": "Section Title"}`
- **矩阵模板**：`["矩阵", "matrix:matrix", "Matrix"]`（前缀 `matrix:` 触发模板）

## 开发

```bash
# 语法验证
node -c main.js
```

## 致谢

公式库提取自 [LaTeXSnipper Office Plugin](https://github.com/LaTeXSnipper)
渲染使用 Obsidian 内置 [MathJax](https://www.mathjax.org/)
