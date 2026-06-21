# Formula Library - Obsidian Plugin

中文文档 | [English](README.md)

LaTeX 公式编辑器，支持 **MathLive WYSIWYG 可视化编辑**、**2100+ 分类公式**、**智能搜索**（拼音、LaTeX 命令、模糊匹配），以及**可扩展的公式文件夹**供用户自定义。

## 功能

- **公式编辑器弹窗**：居中弹窗，左侧实时预览 + LaTeX 输入，右侧公式库
- **2100+ 公式**：18 个分类（希腊字母、结构、分隔符、分析、代数、几何、拓扑、数论、关系、运算、大型运算符、箭头、集合、函数、概率、物理、化学、杂项）
- **搜索**：全局搜索所有公式分类
- **矩阵模板**：支持 cases、matrix、bmatrix、pmatrix、jacobian、hessian、identity、diagonal、augmented 等
- **键盘快捷键**：`Ctrl+F`（分数）、`Ctrl+R`（根号）、`Ctrl+H`（上标）、`Ctrl+L`（下标）、`Ctrl+J`（上下标）
- **Visual / Source 模式**：可视化编辑与 LaTeX 源码切换
- **编辑已有公式**：光标放在 `$...$` 或 `$$...$$` 内，运行命令即可编辑
- **侧边栏快速插入**：左侧边栏直接点击插入公式
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

### 侧边栏快速插入
- 点击 Σ 图标切换侧边栏
- 用标签页切换分类
- 点击公式直接插入到当前光标位置

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
