# Development

Use Node.js 20+ and `npm ci`. Run `npm run check` before committing. It runs
regression tests, rebuilds the assets and syntax-checks the generated plugin.

| Source | Responsibility |
| --- | --- |
| `src/main.js` | Obsidian CommonJS entry |
| `src/plugin.js` | Lifecycle, commands, insertion and view refresh |
| `src/core.js` | Shared settings, localization, metadata, ranked search and data loading |
| `src/data/` | Embedded formulas, search aliases and pinyin mappings |
| `src/settings.js` | Plugin settings and library switches |
| `src/custom-library.js` | Custom category CRUD, backup import/export and validation |
| `src/personal-library.js` | Saving formulas from the editor |
| `src/parameters.js` | Named-parameter templates and presets |
| `src/matrix.js` | Pasted tabular data and matrix editing |
| `src/plot.js` | Expression parsing, sampling, sliders and SVG output |
| `src/drawing.js` | Mermaid editing, source protection, history, drafts and navigation |
| `src/editor.js`, `src/sidebar.js` | Formula editing and browsing |
| `src/ui.js` | Labelled controls and async action feedback |
| `src/typography.js`, `src/styles/typography.css` | Host-following and independently adjustable library fonts |
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
`verify-mathjax-css.cjs` checks CHTML/SVG container selector equivalence and the
box model in an isolated browser. It accepts `FORMULA_TEST_BROWSER_PATH` when
using an already installed Chromium browser rather than Playwright's default.

The release workflow installs the lockfile, runs the checks, rebuilds the assets,
synchronizes versions, attests the assets, and publishes a version tag without `v`.
