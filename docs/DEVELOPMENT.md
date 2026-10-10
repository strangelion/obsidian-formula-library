# Development

LaTeXSnipper Core integration, fixed source/assets and platform
coverage are documented in [CORE-INTEGRATION.md](CORE-INTEGRATION.md).
Desktop browser and native Windows Obsidian checks have passed;
Android phone/tablet checks and their build/device boundaries are recorded in
[ANDROID-TESTING.md](ANDROID-TESTING.md). iOS is not tested on a real device.

Use Node.js 20+ and `npm ci`. Run `npm run check` before committing. It runs
regression tests, checks authored CSS guardrails, rebuilds the assets and syntax-checks the generated plugin.

| Source | Responsibility |
| --- | --- |
| `src/main.js` | Obsidian CommonJS entry |
| `src/conversion.js`, `src/styles/conversion.css` | Bilingual source/output form, capabilities, preview and explicit editor confirmation |
| `src/core-conversion.js` | Host-owned lazy queue, total deadline, cancellation, validation and session cleanup |
| `src/core-assets.js`, `scripts/build-core-assets.mjs` | Fixed WASM/Worker/client assets, Blob bridge, integrity and lifecycle |
| `vendor/core/` | Upstream source archive, readable official TS, fixed WASM/glue, checksums and license inventory |
| `src/plugin.js` | Lifecycle, commands, insertion and view refresh |
| `src/core.js` | Shared settings, localization, metadata, ranked search and data loading |
| `src/data/` | Embedded formulas, search aliases and pinyin mappings |
| `src/settings.js` | Plugin settings and library switches |
| `src/settings-navigation.js`, `src/tools.js`, `src/styles/settings.css` | Accessible grouped settings, optional tool entry preferences and command availability |
| `src/custom-library.js` | Custom category CRUD, backup import/export and validation |
| `src/personal-library.js` | Saving formulas from the editor |
| `src/parameters.js` | Named-parameter templates and presets |
| `src/matrix.js` | Pasted tabular data and matrix editing |
| `src/plot.js` | Expression parsing, sampling, sliders and SVG output |
| `src/drawing.js` | Mermaid editing, source protection, history, drafts and navigation |
| `src/editor.js`, `src/sidebar.js` | Formula editing and browsing |
| `src/ui.js` | Labelled controls and async action feedback |
| `src/typography.js`, `src/styles/typography.css` | Host-following and independently adjustable library fonts |
| `src/backup.js` | Full workspace schema, staged restore/rollback and backup dialog |
| `src/workspace-state.js` | Safe JSON state, drafts and plot configuration metadata |
| `src/formula-details.js` | Structured personal annotations and detail views |
| `src/mathlive.js`, `vendor/mathlive-embedded.js` | Lazy bundled MathLive initialization |
| `src/styles/` | Vendor, foundation, drawing, tools and usability styles |

`scripts/build.mjs` bundles every development dependency into `main.js` and
every stylesheet/font into `styles.css`. Only the host `obsidian` module remains
external. A standard community install needs `main.js`, `manifest.json` and
`styles.css`, without Node.js, npm, `src/`, or `node_modules/` on the device.

`tests/features.test.cjs` uses a mocked host for data and expression regressions.
For actual Obsidian verification, launch a local developer endpoint on port 9223,
set `PLAYWRIGHT_PACKAGE_PATH` to a locally installed Playwright module, and run
`node scripts/obsidian-qa.cjs verify`. The UI check uses a separate QA note,
isolated modal handles, viewport checks and actual SVG scaling measurements.
It restores the original note and locale afterwards. See the script for the
expected scratch note name; do not point test insertion at a user's working note.
Append `dark` to temporarily verify the dark theme (the original preference is
restored afterwards). Add `--no-screenshots` when native Electron window capture
is unavailable; interaction assertions still run, but inspect screenshots from
a capture-enabled pass before release.
Run `node scripts/obsidian-qa.cjs verify-fonts` for actual settings controls,
independent sizing, live Appearance font changes and 18/32 px layouts.
`verify-locale` checks language changes in existing library views and all English
diagram samples while preserving user-authored Chinese content. These checks use
isolated plugin settings; temporary host font preferences are restored afterwards.
`verify-mathjax-css.cjs` checks CHTML/SVG baseline scope and native CHTML
border-box extender exceptions in both stylesheet orders. It accepts `FORMULA_TEST_BROWSER_PATH` when
using an already installed Chromium browser rather than Playwright's default.

`npm run test:ui` runs an isolated Chromium harness with an in-memory adapter:
plot preset/range/draft flows, backup preview/restore, narrow-screen controls,
keyboard actions, density and MathJax CSS scope. Install its browser with
`npx playwright install chromium`; in CI use `--with-deps`. No user vault is
accessed. This harness does not emulate MathLive/MathJax rendering fidelity:
continue native Obsidian verification for rendering and theme compatibility.
It now also runs conversion UI lifecycle checks and the actual fixed Core in
real module Workers via `scripts/verify-core-conversion.cjs`. External HTTP
traffic is blocked in that harness; system browser-filter injection at initial
navigation is reported separately from conversion traffic. These tests do not
prove complete mathematical fidelity or mobile WebView compatibility.

`node scripts/obsidian-conversion-qa.cjs --no-screenshots` checks actual `app://`
Core loading, Typst→LaTeX MathJax rendering, strict LaTeX→OMML text, over-limit
source preservation, explicit draft opening, locale and 1280/390 px control
bounds. It owns its dialogs, cloned settings, dedicated service and in-memory
editor; it does not write user notes or plugin data. Omit the flag when native
Electron frames can be captured. Browser screenshots live in `output/playwright/`.

`node scripts/obsidian-settings-qa.cjs --no-screenshots` checks the five settings
sections, keyboard navigation, six tool switches, live toolbar changes, retained
content, conversion disposal and save-error rollback with native controls.
The test uses cloned preferences and an in-memory editor, not real saved settings.
`npm run lint:css` uses esbuild's CSS parser and project guards against
`!important` and unknown MathJax type selectors; it is not a full Stylelint ruleset.
`node scripts/obsidian-workspace-qa.cjs --no-screenshots` verifies backup preview,
plot presets/ranges/drafts, configuration insertion, formula draft recovery,
keyboard navigation and source-settings alignment using owned native dialogs,
cloned settings and an in-memory editor. It asserts that real user settings are
unchanged. Omit the switch for screenshot capture when Electron frames are available.

Native Android runs use a user-approved ADB WebView forward, not desktop viewport
emulation. Set `OBSIDIAN_QA_CDP_URL` and `OBSIDIAN_QA_REAL_DEVICE=1` for the
conversion/settings checks. `obsidian-android-qa.cjs` also needs explicit ADB
executable/device variables for native taps. `obsidian-matrix-qa.cjs` measures
delimiter, table and every glyph bounds, including ragged rows and MathJax 3/4.
Use only one native QA script at a time per WebView. See
[ANDROID-TESTING.md](ANDROID-TESTING.md) for commands and cleanup.

Windows-only Word clipboard acceptance needs a user-approved Word installation:
`node scripts/obsidian-word-clipboard-qa.cjs` drives the dialog's **Copy for
Word** action and calls `scripts/verify-word-clipboard.ps1
-UseCurrentClipboard`, which checks the MathML payload in newly created, unsaved
Word documents. Both replace the clipboard with test equations and never read or
modify user documents; they are not part of `npm run test:ui`.

The release workflow installs the lockfile, runs the checks, rebuilds the assets,
synchronizes versions, attests the assets, and publishes a version tag without `v`.
