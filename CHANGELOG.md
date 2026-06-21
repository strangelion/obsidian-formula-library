# Changelog

All notable changes to Formula Library will be documented in this file.

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
