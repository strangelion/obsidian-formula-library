# Changelog

All notable changes to Formula Library will be documented in this file.

## [1.4.1] - 2026-10-08

### Fixed
- Formula library names no longer use fixed 9 px text. The editor library and sidebar follow Obsidian's Appearance font size by default, updating live when it changes.
- Added **Follow Obsidian font size** and a separate **Formula library font size** control (14–32 px). MathLive's preview size remains independent.
- Library source labels have a readable minimum size; longer names wrap, and card columns/heights adapt to larger fonts without horizontal overflow.
- Language changes refresh sidebar/editor search, filters, buttons and accessibility labels. Automatic language prefers Obsidian's language API; MathLive can switch back to English.
- All eleven Mermaid templates provide English samples. Existing drafts and note diagrams are preserved; bare node references no longer reset a decision node's shape.

## [1.4.0] - 2026-10-08

### Added
- **Custom parameter templates**: create, duplicate, edit and delete personal templates; customize category, LaTeX, parameter labels and defaults with `{{name}}` tokens, live preview and validation. The original `#name#` syntax and saved presets remain compatible.
- **Hidden formula view**: browse hidden entries and restore an individual formula without clearing every hidden item.
- **Development modules**: feature source modules, separate embedded data and styles, an esbuild pipeline, and regression tests; the three Obsidian release assets remain self-contained.
- **Built-in library controls**: a master switch for the built-in library, one switch per category, enable-all/disable-all, and a library section in the settings that lists every category even when the `formulas/` folder is missing.
- **Separate built-in and custom libraries**: the custom folder loads and switches independently of the built-in library, so custom formulas and the formula editor keep working with the built-in library turned off.
- **Custom formula manager**: add, edit, rename, delete, import, and export categories and formulas from the settings tab, with LaTeX validation and duplicate detection before saving.
- **Drawing source protection**: the visual editor detects unsupported Mermaid syntax before switching modes, keeps the original source, and adds undo/redo, restore-original, and a draft that survives closing the modal.
- **Editing existing diagrams**: put the cursor inside a ` ```mermaid ` block and run "Edit Mermaid Diagram at Cursor" or use the editor context menu; the modal opens that block, detects its template from the source, and saving replaces it in place instead of appending a new block.
- **Preview navigation and SVG export**: zoom out/in with a percentage readout, `100%`, and **Fit**; drag inside the preview to pan and hold `Ctrl`/`⌘` while scrolling to zoom; export the current preview as a standalone SVG file.
- **Ranked search**: exact names and exact LaTeX commands rank above prefixes and fuzzy matches; search reports the total hit count and loads more results instead of truncating later categories.
- **Parameterized templates**: 19 templates (quadratic roots, parabola, vertex form, line, sum/product, definite integral, limit, derivative, partial derivative, binomial, 2×2 determinant, normal distribution, Taylor expansion, uniform acceleration, kinetic energy, Newton's second law, …) that use named `#name#` parameters, with a live preview of the generated LaTeX, up to 20 saved parameter presets per template, and insertion from the command palette or the **Templates** button in the editor toolbar; a value starting with `-` is parenthesized automatically so negatives stay correct inside powers and products.
- **Personal formula library**: the **Save to my library** button in the formula editor stores the current formula in the custom library together with a name, tags, and a note; saving the same formula again updates its existing entry and the dialog prefills the stored name, tags, and note; with no custom folder configured, the first save adopts `my-formulas/` in the vault root as the custom library path.
- **Searching tags and notes**: tags match exactly, by prefix, or as a substring (a leading `#` is accepted) and note text matches as a substring, ranking below exact names and commands but above fuzzy matches; tags are shown as `#tag` in the sidebar, the editor grid, and the custom formula manager.
- **Matrix data paste**: paste rows copied from a spreadsheet or plain text and get `matrix`, `bmatrix`, `pmatrix`, `vmatrix`, `Vmatrix`, `array`, `cases`, or `aligned` LaTeX; tab, comma, semicolon, pipe, and space separators are detected automatically, short rows are padded, two-column `aligned` grids are emitted as `left & = right`, the grid can be transposed and have rows or columns added and removed, non-ASCII or space-containing cells can be wrapped in `\text{}`, and the result can be filled into the editor, inserted into the note, or copied as LaTeX.
- **Function plotting**: draw `y = f(x)` from a typed expression with implicit multiplication (`2x`, `3(x+1)`, `x sin(x)`), the usual functions and the constants `pi`/`e`; every other letter becomes a slider (range -10 to 10, step 0.1), curves can be overlaid with automatic quantile-based or manual `y` ranges, the theme can follow the note or be forced light/dark, and the figure can be inserted as inline SVG, written into an image folder (default `plots`) and embedded with `![[...]]`, copied, or downloaded.
- **Callable definitions and local constants in plots**: type `f(x) = x^2 + a` lines into the plot modal and call them from any curve (a definition may call the functions defined above it, while recursion, forward references, repeated parameters, and built-in name clashes are refused with the line number); give each curve its own constants with `a=2, b=a+1`, which shadow sliders of the same name for that curve and stop those sliders from being created. Parentheses are optional as well (`sinx` means `sin(x)` and `x sinx` means `x sin(x)`), with the documented reading that `sin2x` is `sin(2) · x`; a backticked name stays a plain variable, and a curve calling a name that is neither built in nor defined is reported instead of drawing nothing silently.

### Changed
- Reorganized editor actions and tool dialogs around labelled inputs, independently scrolling content, persistent footers, and portrait layouts.
- Moved the personal formula category selector above optional tags and notes, normalized dropdown sizing, and placed focus indicators inside controls to avoid edge clipping.
- Function previews show only their coordinate grid; advanced function definitions can be collapsed.
- Settings changes (library source, categories, font, density, sorting, result limit, language) now refresh the sidebar and any open editor modal immediately.
- Custom categories are labelled in the category dropdowns, and the search summary separates total matches from the number of results currently shown.
- Copying, downloading, or saving a plot as an image now bakes the current theme into the file, because a standalone SVG cannot inherit the note theme; inline inserts keep using `currentColor` and follow the theme as before.

### Fixed
- Prevented the plugin's box-model reset from interfering with MathJax glyphs and stretch delimiters. Oversized formula previews now scroll from a reachable left edge.
- Mermaid zoom, fit, and export now resolve the current SVG after asynchronous rendering replaces it.
- Cross-template undo/redo restores the template and editing mode together. Incompatible source stays in source mode instead of being parsed into the wrong visual form; previews use a proper Obsidian Component lifecycle.
- Fixed reversed plot ranges, scientific notation, implicit `x(x+1)` multiplication, comma-containing local constant expressions, and redundant sliders for locally bound parameters.
- Formula JSON backups retain tags, notes, category settings, and section labels; repeat imports no longer add duplicate formulas.
- Matrix paste retains trailing blank cells and explicitly added empty rows and columns.
- Formula insertion positions the cursor correctly after multiline LaTeX; category selection survives reloads and excludes disabled categories.
- Existing malformed custom formula files are reported rather than being overwritten as empty files. Category counts exclude section headings, and refreshed folders include JSON files not yet listed in their index.
- Embedded (fallback) loading now respects the category switches, so a disabled category is no longer loaded when the bundled data is used.
- Custom `_strings.json` tab names are merged with the built-in strings instead of being ignored, and trailing slashes in the custom folder path no longer break loading.
- Abbreviation matching no longer matches every formula when the query contains no ASCII letters.

## [1.3.1]

### Added
- Visual node and connection editing for Mermaid flowcharts and state diagrams, with bidirectional source synchronization.
- ER, Gantt, timeline, pie, quadrant, and Git graph templates.
- An Excalidraw launcher when the Excalidraw plugin is installed and enabled.

### Fixed
- Mermaid previews now scale to the available canvas and remain centered instead of rendering against the top-left edge.
- Replaced the sidebar card height overrides with a scoped, higher-specificity selector so the plugin CSS contains no `!important` declarations.

## [1.3.0] - 2026-08-28

### Added
- **95 Computing Formulas**: Algorithms, graph theory, information theory, machine learning, computer graphics, signals, and numerical computing. The built-in library now contains 2216 formulas in 19 categories.
- **Formula Controls**: All, Favorites, Pinned, and Recent filters; per-formula pin, hide, copy, and favorite actions; configurable sorting, density, search result limit, and LaTeX labels.
- **Mermaid Diagram Editor**: Flowchart, mind map, sequence, state, and class-diagram templates with source editing, live preview, and direct Markdown insertion.

### Changed
- Rebuilt the editor modal around stable dynamic viewport units and strict single-column mobile fallback.
- Reduced portrait preview whitespace and gave the formula library more useful vertical space.
- Replaced asymmetric formula-card padding with balanced icon slots so card content stays centered.
- Search now correctly matches Latin pinyin initials such as `fs` for “分数”.

### Fixed
- Editing an existing formula now replaces the formula at the cursor instead of inserting a duplicate.
- Mobile virtual-keyboard resizing no longer writes fragile inline `vh` dimensions to the modal container.
- Formula and drawing modals no longer overflow or shift horizontally on narrow portrait viewports.

## [1.2.5] - 2026-06-27

### Added
- **Usage Frequency Tracking**: Every formula insertion is automatically recorded. Search results and category lists are sorted by usage count (most-used first).
- **Favorites System**: Star/unstar any formula with ☆/★. Favorites filter button in both sidebar and editor modal. Favorites persist across sessions.
- **Favorites-First Sorting**: Favorited formulas always appear at the top of lists and search results, ahead of usage-sorted items.
- **Enhanced English Search**: Word-based matching (e.g., "less equal" matches "less than or equal"), abbreviation matching (e.g., "lt" matches "less than"), and subsequence matching on English labels.
- **Expanded SEARCH_ALIASES**: 200+ new English aliases covering LaTeX commands (relations, operators, arrows, accents, delimiters, set theory, etc.).
- **Usage Badge**: Small badge showing insertion count on each formula item.
- **Favorite Star Button**: Inline ☆/★ toggle on every formula item in sidebar list and editor grid.

### Changed
- **Group Selector → Dropdown**: Category tabs replaced with `<select>` dropdown in both sidebar and editor modal for better space efficiency.
- **Sidebar List Layout**: Two-line layout (symbol + LaTeX command) with improved padding and spacing.
- **Smart Search Enhanced**: `smartMatch` now supports word-based English matching, cross-word alias matching, abbreviation matching, and English subsequence matching.

### Fixed
- English users unable to search by description (e.g., "less than or equal" for `\leq`)
- Simple items without English labels (e.g., `\cap`, `\in`) unsearchable by English terms
- Search aliases missing English descriptions for many LaTeX commands

## [1.2.3] - 2026-06-21

### Removed
- **Bridge server and client removed**: The Bridge architecture (Node.js HTTP server for SVG/MathML export) was incomplete — OCR integration with desktop LaTeXSnipper was not functional (Office Bridge doesn't expose OCR results to external consumers), and the export feature was premature. Rather than ship half-working functionality to users, it was removed entirely. Will be re-implemented when the OCR pipeline is ready.

## [1.2.2] - 2026-06-21

### Fixed
- Plugin ID changed from `obsidian-formula-library` to `formula-library` (community submission requirement: ID cannot contain "obsidian")
- MathLive CSS inlined into `styles.css` to bypass Obsidian CSP blocking CDN stylesheets
- MathLive JS embedded as base64 in `main.js` — zero CDN dependency for compliance
- Virtual keyboard not working — `aria-hidden` on MathLive container blocking focus, removed with MutationObserver
- Virtual keyboard causing modal close — keyboard container set to `document.body`, click events stopped from propagating to modal
- Context menu cannot close by clicking empty space — removed `stopPropagation` from mathfield, moved to preview container
- LaTeX source editor not visible — moved from inside preview area to independent bottom section
- LaTeX source hidden in Source mode — toggled with Visual/Source mode switch
- Status bar centered — fixed to left-align
- `loadMathLive` function missing `plugin` parameter — all callers updated
- Duplicate `MATHLIVE_B64` declarations from repeated build — build script deduplication fixed
- CDN font references remaining after build — manual cleanup of duplicate font directory lines
- `saveSettings()` method missing — all settings changes were silently discarded
- `enabledGroups` not initialized on first load — disabling groups had no effect until manual refresh
- "Enable all" toggle not reflecting individual group states after toggling
- Settings panel not re-rendering after toggling groups (required manual Refresh click)
- Keyboard shortcuts hardcoded — now configurable in settings, default to unbound
- `loadBundledFallback` using `require()` which fails in Obsidian sandbox — switched to Vault adapter
- Plugin disable crashing settings window — added try-catch and proper resource cleanup in `onunload()`
- CSS `:has` selector warning — replaced with JS class-based approach
- CSS `!important` warnings — removed from own CSS, kept only in third-party MathLive CSS

### Added
- **MathLive Embedded**: MathLive 0.104.0 embedded as base64 in `main.js` — fully compliant with Obsidian plugin policies (no CDN, no eval via external scripts)
- **Bridge Architecture**: Local HTTP server for enhanced rendering (SVG/MathML export):
  - `bridge/server.js` — Node.js server with KaTeX rendering
  - `bridge/client.js` — Client module (integrated into main.js)
  - `bridge/package.json` — Dependencies
  - `bridge/README.md` — API documentation
  - Settings: Bridge enable toggle + URL configuration
  - Plugin methods: `bridgeConvert()`, `bridgeExport()`
  - Modal: SVG/MathML export buttons (visible when Bridge connected)
- **Configurable Keyboard Shortcuts**: Custom shortcuts for fraction, sqrt, superscript, subscript, sub-super (default: unbound)
- **Bridge Settings**: Enable/disable Bridge, URL configuration
- **Search Hints**: Gray hint text below search inputs showing supported search modes
- **LaTeX Source Editor**: Small editing area below the MathLive editor for raw LaTeX input
- **Formula Group Toggles**: Enable/disable individual formula categories in settings with auto-detect and refresh button
- **GitHub Actions Workflow**: One-click release with version sync, MathLive embedding, and artifact attestation
- **`exportViaBridge` method**: Export formula to SVG/MathML via Bridge, copy to clipboard

### Changed
- MathLive loaded from `vendor/mathlive.min.js` via Vault adapter (local, no CDN)
- Fonts loaded from local `vendor/fonts/` directory
- MathLive CSS inlined into `styles.css` (bypass CSP)
- Settings page: all labels follow selected language dynamically
- Modal height dynamically adjusts when virtual keyboard is shown/hidden
- `loadMathLive` now requires `plugin` parameter for Vault adapter access
- `onunload` properly cleans up MathLive script tags and detaches sidebar leaves

## [1.1.1] - 2026-06-21

### Fixed
- `saveSettings()` method missing — all settings changes were silently discarded
- `enabledGroups` not initialized on first load — disabling groups had no effect until manual refresh
- "Enable all" toggle not reflecting individual group states after toggling
- Settings panel not re-rendering after toggling groups (required manual Refresh click)
- Sidebar refresh causing full view rebuild — now uses targeted `renderTabs()` + `renderList()`
- Keyboard shortcuts hardcoded — now configurable in settings, default to unbound
- Shortcut labels not following selected language
- `loadBundledFallback` using `require()` which fails in Obsidian sandbox — switched to Vault adapter
- Plugin disable crashing settings window — added try-catch and proper resource cleanup in `onunload()`

## [1.1.0] - 2026-06-21

### Added
- **MathLive Visual Editor**: Replaced MathJax preview with MathLive 0.104 WYSIWYG interactive editor with virtual keyboard
- **Smart Search**: Pinyin initials (e.g., `js` → 极限), LaTeX command aliases (e.g., `frac` → 分数), and fuzzy subsequence matching
- **Settings Page**: Full Obsidian settings tab with configurable options:
  - Language (auto/zh/en)
  - Insert format (display `$$...$$` / inline `$...$`)
  - Default editor mode (visual/source)
  - MathLive virtual keyboard toggle
  - Preview font size (12-40px)
  - Math font style (italic/upright) and custom font family
  - Formula group toggles with auto-detect and refresh button
  - Configurable keyboard shortcuts (fraction, sqrt, superscript, subscript, sub-super)
- **Formula Folder Structure**: Formulas split into individual JSON files (`formulas/`) for easy user customization
- **Editor Tracking**: Sidebar works correctly when moved to right/bottom panel or in split view via `active-leaf-change` event tracking
- **Placeholder Cursor**: Inserting formulas with `#?` placeholders auto-selects the first placeholder for immediate editing
- **MathLive Menu Localization**: Full Chinese translation for MathLive context menu, tooltips, and virtual keyboard
- **Search Hints**: Gray hint text below search inputs showing supported search modes
- **GitHub Actions Workflow**: One-click release publishing with automatic version sync to `manifest.json`

### Fixed
- Formula rendering broken by CSS overrides — restored original `obsidian.renderMath` approach
- Modal sizing too small — now opens at ~1600x900px via JS dimension control
- Right-side formula panel buttons truncated — grid layout changed to `auto-fill` with `minmax`
- Settings crash on plugin disable — `onunload` wrapped in try-catch with proper resource cleanup
- Settings never persisted — added missing `saveSettings()` method wrapping `this.saveData()`
- BRAT compatibility — embedded fallback formula data directly in `main.js` as `BUNDLED_FALLBACK`

### Changed
- `main.js` refactored from single-file embedded data to dynamic loading from `formulas/` folder
- `manifest.json` description updated for community plugin submission
- `README.md` rewritten in English with cross-link to `README-cn.md`
- `README-cn.md` updated with new features and customization documentation
- `onunload` now cleans up MathLive script/CSS tags and detaches sidebar leaves individually

## [1.0.0] - 2026-06-20

### Added
- Initial release
- LaTeX formula editor with 2100+ categorized formulas (18 categories)
- Formula editor modal with real-time MathJax preview
- Sidebar quick insert with tabbed categories
- Visual / Source mode toggle
- Matrix template support (cases, bmatrix, pmatrix, jacobian, hessian, identity, diagonal, augmented)
- Edit existing formulas at cursor position
- Chinese/English bilingual UI
- Keyboard shortcuts: `Ctrl+F` (fraction), `Ctrl+R` (sqrt), `Ctrl+H` (superscript), `Ctrl+L` (subscript), `Ctrl+J` (sub-super)
- `Shift+Enter` to accept formula
