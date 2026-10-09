# Formula Library - Obsidian Plugin

[中文文档](README-cn.md) | English Doc

Visual LaTeX editing, a searchable formula library, customizable templates, Mermaid diagrams, and parameter-driven function plotting for Obsidian.

Formula Library helps you create, find, and reuse mathematical notation in your notes. It combines MathLive-based visual LaTeX editing with **2,216 built-in formulas across 19 categories**, smart search, and independently configurable built-in and personal libraries.

Create your own parameterized templates, keep named presets, generate matrices from pasted tables, and explore functions with live parameter controls. The Mermaid editor includes **11 diagram templates**, visual editing for flowcharts and state diagrams, live previews, and SVG export.

Favorites, pins, recent items, searchable annotations, full workspace backups, and recoverable drafts help keep your work organized. Responsive layouts, adjustable fonts and density, and English and Chinese interfaces adapt to different screens and workflows.

## Features

- **MathLive Visual Editor**: WYSIWYG formula editing with real-time preview and virtual keyboard
- **2216 Formulas**: 19 categories, including 95 formulas for algorithms, information theory, machine learning, graphics, signals, and numerical computing
- **Smart Search**: Pinyin initials, LaTeX command aliases, word-based English matching, abbreviation matching (e.g., "lt" → less than), and fuzzy matching; exact names and exact commands rank first, and search shows the total hit count with load-more instead of truncating later categories
- **Usage Frequency Sorting**: Formulas you use most appear first — search results and category lists are sorted by insertion count
- **Formula Controls**: Favorites, pins, recent items, hidden formulas, smart/usage/recent/name sorting, card density, and result limits
- **Library Controls**: A master switch for the built-in library, one switch per category (19), enable-all/disable-all, and category management that works even when the `formulas/` folder is missing; switching a category off only hides it — favorites, pins, and history stay intact
- **Built-in / Custom Separation**: The custom library loads and switches independently of the built-in library, so the custom formulas and the formula editor keep working with the built-in library switched off; an empty library never switches the built-in library back on
- **Custom Formula Manager**: Add, edit, rename, delete, import, and export categories and formulas from the settings tab, with LaTeX validation and duplicate detection before saving
- **Parameterized Templates**: 19 ready-made templates (quadratic roots, parabola, vertex form, line, sum/product, definite integral, limit, derivative, partial derivative, binomial, 2×2 determinant, normal distribution, Taylor expansion, uniform acceleration, kinetic energy, Newton's second law, …) that use named parameters instead of bare placeholders — fill in the values and the preview updates live, keep up to 20 parameter presets per template, then insert into the note or into the editor
- **Live Settings**: Changing the library source, categories, font, density, sorting, or result limit refreshes the sidebar and any open editor modal immediately
- **Personal Formula Library**: Save the formula you are editing straight into the custom library with a name, tags, and a note; tags and notes are searchable, and JSON backups keep them
- **Formula Details**: View the complete LaTeX and annotations from a formula's actions menu; personal entries can include variable meanings, units, conditions and sources. These fields are searchable and survive JSON backup/import.
- **Full Backup and Restore**: Back up personal formula categories, templates, parameter and plot presets, favorites, pins, history, drafts and settings in one versioned JSON file; preview before restoring and choose how matching entries are handled.
- **Recoverable Drafts**: Formula and function plot editors keep unfinished work with explicit restore/discard actions; Mermaid drafts remain supported. Draft storage can be disabled in settings.
- **Mermaid Diagrams**: 11 templates; flowcharts and state diagrams include node/connection visual editing, with centered preview and Markdown insertion for every type; existing ` ```mermaid ` blocks can be edited in place, the preview supports zoom/pan/fit and SVG export, unsupported syntax is detected before switching to visual editing, and the source is preserved with undo/redo, restore-original, and a draft that survives closing the modal
- **Configurable Shortcuts**: Custom keyboard shortcuts for fraction, sqrt, superscript, subscript (default: unbound)
- **Matrix Templates**: cases, matrix, bmatrix, pmatrix, jacobian, hessian, identity, diagonal, augmented
- **Matrix Data Paste**: paste rows from Excel, a table, or plain text and get matrix, bmatrix, pmatrix, vmatrix, Vmatrix, array, cases, or aligned LaTeX - tab, comma, semicolon, pipe, and space separators are detected automatically, and the grid can be transposed, resized, or have its text cells wrapped in `\text{}` before inserting
- **Function Plotting**: draw `y = f(x)` from a typed expression - implicit multiplication, functions without parentheses, and the usual function set are supported, every letter other than `x` becomes a slider, and you can write your own function definitions plus per-curve local constants; curves can be overlaid with an automatic or manual range and a follow/light/dark theme, and the figure can be inserted as SVG, saved as an image embed, copied, or downloaded
- **Visual / Source Mode**: Toggle between WYSIWYG and raw LaTeX editing
- **Edit Existing Formulas**: Place cursor inside `$...$` or `$$...$$` and run command to edit
- **Sidebar Quick Insert**: Click formulas in the sidebar to insert directly
- **Group Dropdown**: Category selector as dropdown for compact sidebar layout
- **Settings Page**: Language, insert format, editor mode, shortcuts, font size/style, density, sorting, search limits, labels, library source and category switches, and the custom formula manager
- **Extensible Formula Folders**: Add categories to the built-in library by dropping JSON files into `formulas/`, or point the plugin at your own folder (relative to the vault root) whose categories are managed separately
- **Bilingual**: Full Chinese/English localization, follows Obsidian language setting

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the same [release](https://github.com/strangelion/obsidian-formula-library/releases).
2. Create `.obsidian/plugins/formula-library/` inside your vault and place those three files in it.
3. Enable Formula Library in **Settings → Community plugins**.
4. Optionally assign hotkeys in **Settings → Hotkeys**.

The installed plugin does not need Node.js, npm, `src/`, `node_modules/`, or a separate `formulas/` directory.

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
- Changing settings (font, density, sorting, category switches, ...) refreshes the right-hand list without reopening the modal
- The **Templates** button in the toolbar opens the parameterized template dialog and fills the result into the editor
- The **Paste matrix data** button in the toolbar opens the matrix paste dialog and fills the pasted table into the editor
- The **Plot function** button in the toolbar opens the function plot dialog and inserts the drawn figure into the note
- The **Save to my library** button in the toolbar saves the current formula into your personal library (see below) with a name, tags, and a note
- Click **Insert** (or `Shift+Enter`) to write the formula to your note
- An unfinished formula is kept as a draft when you close the editor. On reopening a matching editing context, choose **Restore draft** or **Discard draft**; the draft never silently replaces the current formula. Drafts are saved after a short pause and when closing.

### Parameterized Templates

- **My templates**: choose **New template** or **Duplicate template** to customize the name, category, LaTeX, parameter labels and defaults. For example: `y = {{a}} \cdot x + {{b}}`. Parameter names start with an ASCII letter and contain letters, digits or underscores. Personal templates can be edited, deleted with confirmation and used with presets; they persist in plugin settings. Built-in templates remain read-only.
- Unnamed drafts still preview; a name is required only when saving. The preview substitutes defaults. Use `\cdot` explicitly for multiplication so numeric substitutions stay separate.

- **Command Palette**: `Ctrl+P` → "Insert Parameterized Formula", or click **Templates** in the formula editor toolbar to fill the result into the editor
- Pick a template and fill in the named parameters: the preview and the generated LaTeX update as you type
- Parameter values may be plain numbers or LaTeX (`\frac{1}{2}`, `\sigma`, `(-3)`); leave a field empty to keep the template default
- A value starting with `-` is parenthesized automatically, so `-3` stays correct inside powers, products, and after a minus sign
- **Presets**: save, apply, and delete up to 20 parameter combinations per template; presets persist across sessions

### Personal Formula Library
- Click **Save to my library** in the formula editor toolbar to store the current formula (including whatever the visual editor holds) in the custom library
- Fill in a name, tags, and a note: tags are separated by spaces or commas (for example `algebra exam`), and the note can explain variable meanings, when the formula applies, or common rearrangements
- Save into an existing category or type a new category name and let the plugin create it
- Saving the same formula again **updates the entry it already has**, and the dialog prefills the saved name, tags, and note
- Tags and notes are searchable: type `#algebra` or part of a tag to find the entry, and words from the note match as well
- Open **Formula details** from the actions menu to see the full source and annotations. In **Save to my library** or the custom formula manager, expand **Variables, units, conditions and source** to add structured details. Built-in entries remain read-only; save a personal copy to annotate them.
- With no custom folder configured, the first save uses `my-formulas/` in the vault root and records it as the custom library path in the settings

### Matrix Data Paste
- **Command Palette**: `Ctrl+P` → "Paste Matrix Data", or click **Paste matrix data** in the formula editor toolbar
- Paste rows from Excel, a table, or any text: tab, comma, semicolon, pipe, and space separators are detected automatically, and short rows are padded to the widest one
- Choose the environment: matrix, bmatrix, pmatrix, vmatrix, Vmatrix, array, cases, or aligned; a two-column aligned grid is emitted as `left & = right`
- **Transpose** and the add/remove row and column buttons edit the grid directly; the changes are written back to the text box and the preview and size update as you type
- Tick **Wrap text cells in `\text{}`** to turn non-ASCII or space-containing cells into `\text{...}`; numbers, ASCII variables, and existing LaTeX stay as they are
- Supports **Use in editor**, **Insert into note**, and **Copy LaTeX**

### Function Plotting
- **Command Palette**: `Ctrl+P` → "Plot Function", or click **Plot function** in the formula editor toolbar
- Draw `y = f(x)` from an expression: `+ - * / ^`, parentheses, implicit multiplication (`2x`, `3(x+1)`, `x sin(x)`), the usual functions (sin, cos, tan, ln, log10, sqrt, abs, min/max, pow, ...), and the constants `pi` and `e`; the parentheses are optional too (`sinx` means `sin(x)` and `x sinx` means `x sin(x)`), which makes `sin2x` mean `sin(2) · x` (write `sin(2x)` for the other reading), and a name in backticks (`` `sinx` ``) stays a plain variable
- Every free variable other than `x` and the known constants becomes a slider (initial range -10 to 10, step 0.1). Enter exact numeric values or expand **Range and step** to customize each parameter; invalid bounds, out-of-range values and non-positive steps disable export until corrected.
- **Plot presets**: save up to 50 named configurations containing curves, local constants, function definitions, axes, theme, parameter values, ranges and steps. Apply or delete a preset from the plot editor. Use a new name when saving a variation.
- Add several curves to overlay them, each with its own colour and legend entry; set the `x` and `y` ranges by hand or tick **Auto y** to derive the vertical range from the sampled quantiles
- **Function definitions**: type lines such as `f(x) = x^2 + a` in the box at the top of the modal and call them from later definitions and from any curve; free variables of a definition (like `a`) become sliders, and a parameter name shadows the axis variable `x` inside that function. Recursion, forward references, repeated parameters, and names that clash with a built-in function are refused with the line number
- **Local constants**: each curve can carry its own `a=2, b=a+1`, so one letter can mean different things in different curves; when a name also has a slider, the local constant wins for that curve and no slider is created for it
- Theme: **Follow theme** (an inline SVG uses `currentColor`, so it adapts to light and dark notes), light, or dark; **copying, downloading, or saving the figure as an image bakes the current theme into the file** (a standalone SVG cannot inherit the note theme, so re-export after switching themes)
- Output: **Insert SVG** (puts the vector markup in the note), **Save image and embed** (writes the file into the image folder and inserts an `![[...]]` embed), **Copy SVG**, and **Download SVG**; the image folder defaults to `plots`
- New note inserts carry their plot configuration in an adjacent HTML comment. Put the cursor inside the plot block or its image embed and run **Edit Function Plot at Cursor** to reopen it. **Insert SVG** updates that block in place; if the note block changed while the editor was open, reopen it before updating. **Save image and embed** creates a new image/insert instead. Keep the configuration comment if you want to edit the plot again.
- Older SVGs without configuration metadata cannot reliably recover their expressions. Copied/downloaded SVGs are static images, and saved note plots do not contain live sliders; parameter interaction happens in the plot editor.
- Unfinished plots offer **Restore draft** and **Discard draft** when reopening. Toggle **Keep unfinished drafts** in settings to control formula, plot and Mermaid draft storage.

### Mermaid Diagram Editor
- **Command Palette**: `Ctrl+P` → "Open Mermaid Diagram Editor"
- **Edit an existing diagram**: put the cursor inside a ` ```mermaid ` block, then run "Edit Mermaid Diagram at Cursor" or use **Edit Mermaid Diagram** in the editor context menu — the modal opens that block's source and saving replaces it in place instead of appending a new block
- **Preview navigation**: `−` / `+` / percentage / `100%` / **Fit** in the preview header; drag inside the preview to pan and hold `Ctrl`/`⌘` while scrolling to zoom
- **Export SVG**: the toolbar's **Export SVG** button saves the current preview as a standalone vector file
- Flowcharts and state diagrams switch between **Visual / Source** modes, with direct node, connection, direction, shape, and label controls
- Templates include flowchart, mind map, sequence, state, class, ER, Gantt, timeline, pie, quadrant, and Git graph; the template of an edited block is detected automatically from its source
- When Excalidraw is installed, the toolbar exposes a shortcut for freehand and drag-and-drop drawing
- Click **Insert diagram** (or `Shift+Enter`) to insert a native Mermaid code block

### Sidebar Quick Insert
- Click the Σ icon to toggle the sidebar
- Use the dropdown to switch categories (custom categories are labelled "Custom")
- The search box understands pinyin initials (`fs` → 分数), LaTeX commands (`frac`), English words, and fuzzy matches, and results are sorted by relevance
- Search reports "N matches · showing M" with a **Show more** button, so later categories are never truncated away
- Click ☆ to favorite a formula, click ★ to unfavorite
- Click a formula to insert directly at cursor position
- In the search box, use **Up/Down** to select a visible result and **Enter** to insert it. Favorite and actions controls support **Enter/Space** without inserting the enclosing formula. **Escape** clears the keyboard selection.
- Most-used formulas appear first in each category

### Backup and Restore

Open **Settings → Formula Library → Backup and restore → Manage backups**, or run **Manage Formula Library Backups** from the command palette.

1. Choose **Download full backup** to save a versioned JSON file. It includes disabled personal categories as well as your templates, presets, favorites, pins, hidden/recent formulas, usage counts, drafts and known plugin settings. Built-in formula data and saved image files are not duplicated in this backup.
2. To restore, select a JSON file (up to 10 MB) or paste its contents. Choose **Keep existing on conflict** or **Use backup on conflict**. Matching formulas are identified by LaTeX within a category; templates by their key, and presets by name.
3. Optionally restore UI and category preferences. Folder paths are never imported: personal formulas go to the currently configured folder, or `my-formulas` if none is configured. The preview shows this destination.
4. Click **Validate and preview**, review the summary, then **Confirm restore**. Editing the input or options invalidates the preview and requires another check.

Restore is additive: unmatched existing entries/categories remain intact. It validates and stages destination reads before writing, and attempts to roll back exact file bytes and settings if a write fails. A rollback failure is reported explicitly. Save a fresh backup before large changes; plugin backups are not a replacement for backing up the vault itself.

The older custom-library JSON/text export remains available in **Manage custom formulas**. Use the full workspace backup for templates, presets and preferences; the two formats have separate import dialogs.

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
| Computing | 95 | Algorithms, graph theory, information theory, ML, graphics, signals, numerical methods |
| Physics | 251 | Mechanics, EM, quantum, relativity, QFT |
| Chemistry | 229 | Reactions, molecules, ions, thermodynamics |
| Misc | 56 | Ellipsis, infinity, special symbols |

## Custom Formulas

There are two libraries: the **built-in library** (the `formulas/` folder inside the plugin directory, or the embedded data when that folder is missing) and the **custom library** (a folder you choose in the settings, relative to the vault root). They load and switch independently, so the custom library and the formula editor keep working with the built-in library turned off.

### Visual Editing (Recommended)

Settings → Formula Library → **Manage custom formulas** lets you:

- **Create a category**: type a name; the category id is generated for you
- **Add / edit a formula**: fill in a name, an optional English name, the LaTeX, tags, and a note; saving checks for empty values, `$` delimiters, unbalanced braces, and duplicates elsewhere in the library
- **Import**: paste a JSON array, a JSON backup, or one `name<TAB>latex` per line (with `#` / `//` comments)
- **Export**: export plain text or a JSON backup, copy it to the clipboard, or download it as a file
- **Delete**: remove a single formula or a whole category (the category file, its `_index.json` entry, and its switch are cleaned up together)

Renaming a category only touches its display name: other fields (such as `structures`) and manual edits inside the file are preserved.

The manual workflow below still works and is useful for bulk maintenance and version control.

Formula data is stored in the `formulas/` folder inside the plugin directory, with one JSON file per category.

> **BRAT / community plugin compatibility**: Built-in data and runtime dependencies are bundled in `main.js`. Installation needs only `main.js`, `manifest.json`, and `styles.css`; `formulas/` is optional development data.

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
- **Personal library metadata**: `["Name", "\\latex", "English name", {"tags": ["algebra"], "note": "why it matters"}]` (the 4th element is optional and only used by the custom library; tags are shown as `#tag` in lists)
- Optional metadata fields: `variables`, `units`, `conditions`, and `reference` are plain-text strings. They appear in **Formula details** and are included in search and JSON backups.

### Library font size

Formula names, source labels and library controls follow **Settings → Appearance → Font size** by default, in both the editor's right-hand panel and the sidebar. To choose an independent size, open **Settings → Formula Library**, turn off **Follow Obsidian font size**, then adjust **Formula library font size** (14–32 px). Changes apply to open libraries immediately. **Preview font size** only controls the MathLive editing area.

## Development

## Future conversion extensions and support boundaries

**Planning only: version 1.5.0 does not integrate LaTeXSnipper Core, discover conversion providers, or install conversion runtimes.** Its `src/core.js` contains plugin utilities, not the Rust Core. Third-party conversion extensions will be considered separately; existing LaTeX editing does not depend on them.

The preferred direction is an optional, explicitly enabled provider installed independently by the user. Bundling a conversion runtime remains a separate packaging/licensing decision. There is no working Core installation procedure in this version. The official [Obsidian developer policies](https://docs.obsidian.md/community-directory/developer-policies) prohibit plugins from installing/updating themselves or their dependencies; we do not plan an in-plugin runtime installer. An extra `.wasm` release asset alone is not part of this plugin's standard three-file installation.

| Candidate capability | Boundary for a future provider |
| --- | --- |
| Typst, MathML, OMML and LaTeX conversion | Only routes reported available by the installed provider/version; preview reconstructed output before inserting. |
| Strict conversion | Core currently exposes only a supported LaTeX-to-OMML subset; strict does not mean complete TeX support or visual/round-trip identity. |
| Best-effort conversion | Explicit opt-in with limitations shown; preserve the original source. |
| AsciiMath, UnicodeMath, MTEF / MathType | Not available through the evaluated Core registered formula conversion API; experimental source parsers are not a support promise. |
| Word objects, OCR, PDF / DOCX / PPTX generation | Outside the proposed formula-string provider scope. OMML XML alone does not provide Word clipboard or OLE integration. |

The evaluated complete Core WASM is about 15.1 MiB plus matching generated JavaScript; a smaller conversion-only build is not currently an available feature switch. Its local wrapper package is private, and Actions artifacts must not be advertised as an existing public npm/release installation. The plugin is MIT and Core declares AGPL licensing: manual installation, separate plugins, or dynamic loading do not remove the need to review the actual combination/distribution. No licensing change or Core redistribution is made here.

For future defects, the intended workflow is: show the provider/version and conversion route, retain the input, classify unsupported syntax separately from conversion failure, preview the result, and require confirmation before writing. No silent cloud fallback or lossless-conversion promise. A diagnostic report should contain versions, mode, error code and optional user-reviewed minimal examples—not automatically send notes, clipboard contents, or vault paths. UI/insertion defects belong here; converter accuracy/runtime defects belong upstream, with adapter reproductions and regression cases helping both projects.

See the [conversion extension assessment and proposed support contract](docs/CONVERSION-EXTENSIONS.md) and [Core formula API boundaries](https://github.com/strangelion/latexsnipper-core/blob/main/crates/wasm/js/README.md). These are a roadmap, not an implemented extension API or permission to load arbitrary code.

## Development

Feature source lives in `src/`; do not edit generated `main.js` or `styles.css` directly. See [development](docs/DEVELOPMENT.md) and [UI acceptance rules](docs/UI-GUIDELINES.md).

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:ui
```

## Data and Privacy

Personal formulas are stored in your chosen vault folder. Settings, templates, presets and drafts use Obsidian's plugin data storage; saved plot images go to the configured image folder. Backup files can contain private formulas, annotations, drafts and folder names—store them securely.

Clipboard access is used for copy/paste features. This is why automated plugin reviews may disclose clipboard access; the new backup and plotting features do not add background clipboard monitoring or an external service. Review results marked unavailable are not security guarantees.

The mathematical editor and diagram features rely on MathLive and Obsidian's rendering environment. A separate account or plotting server is not required, but this is not a guarantee that every host or rendering resource is network-free.

## Acknowledgments

Formula library extracted from [LaTeXSnipper Office Plugin](https://github.com/LaTeXSnipper)
Rendering uses Obsidian's built-in [MathJax](https://www.mathjax.org/) and [MathLive](https://cortexjs.io/mathlive/)
