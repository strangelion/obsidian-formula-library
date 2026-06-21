# Formula Library - Obsidian Plugin

[中文文档](README-cn.md) | English Doc

A LaTeX formula editor for Obsidian with **MathLive WYSIWYG editing**, **2100+ categorized formulas**, **smart search** (pinyin, LaTeX commands, fuzzy matching), and **extensible formula folders** for user customization.

## Features

- **MathLive Visual Editor**: WYSIWYG formula editing with real-time preview and virtual keyboard
- **2100+ Formulas**: 18 categories (Greek, Structures, Delimiters, Analysis, Algebra, Geometry, Topology, Number Theory, Relations, Operators, Big Ops, Arrows, Sets, Functions, Probability, Physics, Chemistry, Misc)
- **Smart Search**: Pinyin initials, LaTeX command aliases (e.g., `frac` → Fraction), and fuzzy matching
- **Matrix Templates**: cases, matrix, bmatrix, pmatrix, jacobian, hessian, identity, diagonal, augmented
- **Visual / Source Mode**: Toggle between WYSIWYG and raw LaTeX editing
- **Edit Existing Formulas**: Place cursor inside `$...$` or `$$...$$` and run command to edit
- **Sidebar Quick Insert**: Click formulas in the sidebar to insert directly
- **Settings Page**: Language, insert format, editor mode, font size, font style, formula group toggles
- **Extensible Formula Folders**: Add custom formula groups by dropping JSON files into `formulas/`
- **Bilingual**: Full Chinese/English localization, follows Obsidian language setting

## Installation

### Manual
1. Copy `obsidian-formula-library` folder to your Vault's `.obsidian/plugins/` directory
2. Enable in Obsidian Settings > Community Plugins
3. (Optional) Set a hotkey for "Open Formula Editor" in Settings > Hotkeys

### BRAT
1. Install the BRAT plugin in Obsidian
2. Open BRAT settings, click "Add Beta plugin"
3. Enter: `strangelion/obsidian-formula-library`
4. Restart Obsidian after installation

## Usage

### Formula Editor
- **Command Palette**: `Ctrl+P` → "Open Formula Editor"
- **Ribbon Icon**: Click the Σ icon on the left
- Select a formula category on the right, click a formula to insert into the editor
- Click **Insert** (or `Shift+Enter`) to write the formula to your note

### Sidebar Quick Insert
- Click the Σ icon to toggle the sidebar
- Use tabs to switch categories
- Click a formula to insert directly at cursor position

### Edit Existing Formulas
- Place cursor inside `$...$` or `$$...$$`
- Run command "Edit Formula at Cursor"
- Modify and click **Update**

## Formula Categories

| Category | Count | Description |
|----------|-------|-------------|
| Greek | 52 | α, β, γ, ... |
| Structures | 43 | Fractions, roots, integrals, sums, matrices |
| Delimiters | 36 | Parentheses, brackets, braces, absolute value |
| Analysis | 210 | Real/complex/functional analysis, measure theory |
| Algebra | 174 | Linear algebra, group/ring/module theory |
| Geometry | 133 | Classical, differential, Riemannian, symplectic |
| Topology | 166 | Point-set, algebraic, differential |
| Number Theory | 166 | Elementary, analytic, algebraic, modular forms |
| Relations | 112 | Equalities, order, subsets, logic |
| Operators | 64 | Arithmetic, set, logic operators |
| Big Ops | 20 | Sums, products, integrals, unions, intersections |
| Arrows | 68 | Various arrow symbols |
| Sets | 40 | Set theory, logic, cardinals |
| Functions | 131 | Elementary, special functions, distributions |
| Probability | 170 | Distributions, theorems, stochastic processes |
| Physics | 251 | Mechanics, EM, quantum, relativity, QFT |
| Chemistry | 229 | Reactions, molecules, ions, thermodynamics |
| Misc | 56 | Ellipsis, infinity, special symbols |

## Custom Formulas

Formula data is stored in the `formulas/` folder inside the plugin directory, with one JSON file per category. Users can add new formulas or categories directly.

> **BRAT Compatibility**: The plugin includes embedded fallback data in `main.js`. If the `formulas/` folder cannot be loaded, the plugin automatically uses the fallback. When releasing, include the entire `formulas/` folder in your release assets.

### File Structure

```
formulas/
  _index.json          # Category ordering (optional, auto-discovered if missing)
  _strings.json        # UI translation strings
  greek.json           # Greek letters
  structures.json      # Structures
  analysis.json        # Analysis
  ...                  # Other categories
```

### Adding Formulas to an Existing Category

Edit the corresponding JSON file and add new formulas to the `items` array:

```json
{
  "id": "greek",
  "structures": false,
  "items": [
    ["α", "\\alpha"],
    ["β", "\\beta"],
    ["Custom", "\\mycommand{#?}", "Custom Formula"]
  ]
}
```

### Adding a New Category

1. Create a new JSON file in the `formulas/` directory (e.g., `mycategory.json`):

```json
{
  "id": "mycategory",
  "structures": false,
  "items": [
    ["Formula Name", "\\latex{code}", "English Name"]
  ]
}
```

2. Add the category ID to the `order` array in `_index.json`:

```json
{
  "order": ["greek", "structures", "...", "mycategory"]
}
```

> If `_index.json` doesn't exist or doesn't include the new category ID, the plugin auto-discovers and loads groups alphabetically.

### Formula Format

Each formula is an array: `[label_zh, LaTeX code, label_en (optional)]`

- **Simple**: `["α", "\\alpha"]`
- **With English label**: `["Fraction", "\\frac{#?}{#?}", "Fraction"]`
- **Section marker**: `{"section": "Section Title", "sectionEn": "Section Title"}`
- **Matrix template**: `["Matrix", "matrix:matrix", "Matrix"]` (prefix `matrix:` triggers template)

## Development

```bash
# Syntax check
node -c main.js
```

## Acknowledgments

Formula library extracted from [LaTeXSnipper Office Plugin](https://github.com/LaTeXSnipper)
Rendering uses Obsidian's built-in [MathJax](https://www.mathjax.org/) and [MathLive](https://cortexjs.io/mathlive/)
