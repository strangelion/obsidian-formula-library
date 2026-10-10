# Android verification

Checked on 2026-10-10 using user-authorized ADB access. Tests ran inside the
actual Obsidian WebViews, without browser viewport emulation.

| Device | Host | Observed CSS viewport | Renderer |
| --- | --- | --- | --- |
| Xiaomi phone 2211133C | Android 16; Obsidian 1.14.4; WebView 145.0.7632.159 | 392 × 872 portrait; 872 × 392 landscape | MathJax 4.1.3 |
| Xiaomi tablet 24018RPACC | Android 16; Obsidian 1.13.8; WebView 146.0.7680.177 | approximately 1219 × 813 landscape and 813 × 1219 portrait; host insets can change this by 1 px | MathJax 3.2.2 |

## Passed checks and limits

- Simple samples across all 16 exposed best-effort combinations of LaTeX,
  Typst, MathML and OMML inputs and bare LaTeX, Typst, MathML and OMML outputs.
  These are smoke tests, not complete mathematical fidelity or round-trip tests.
- Conversion UI: actual local Core loading, Typst-to-LaTeX MathJax preview,
  explicit strict LaTeX-to-OMML text, input limits, source preservation and
  opening a draft without writing a note; English and Chinese.
- Native settings controls, independent tool switches and retained content,
  using cloned preferences rather than overwriting user settings.
- Native Android taps for matrix transpose, Mermaid zoom/reset, delete and undo;
  cross-template undo restores the appropriate editor mode. Phone and tablet
  icon controls retain 44 px targets and 16 px SVGs.
- Phone editor: auxiliary tools start collapsed; source/editor and formula
  library share the content scroller; insert/cancel remain reachable.
- Matrix geometry: three fixtures (ragged 3 × 2, regular 2 × 3 and tall 5 × 2),
  four delimiter environments (`bmatrix`, `pmatrix`, `vmatrix`, `Vmatrix`),
  12 cases per run. Both devices passed in portrait/landscape and light/dark
  checks. Delimiters enclose all glyph rows, with center error below 3 CSS px.
  MathJax 4 CHTML intentionally uses border-box for stretchy extenders; the
  plugin must not override that with a high-specificity content-box reset.
- Parameter previews, function plotting and numeric parameters.

On Obsidian 1.14.4, Mermaid was initially blocked by the host's vault trust
prompt. The user manually allowed it before the phone drawing checks passed.
Tests do not bypass this prompt or change the trust setting themselves.

No real note writes, clipboard writes, backup restore or image export were
performed by these scripts. Saved plugin preferences were preserved. Native
keyboard/IME behavior, persistence across restarts, Office-native formula paste,
all possible expressions and iOS are **not certified** by these checks.

The matrix regression script now additionally covers triangular 3 × 3 data
(`1 1 1`, `1 1`, `1`), for 16 cases per run. Post-release desktop checks on
2026-10-11 passed all 16 cases in both light and dark themes with MathJax 4.1.3
and the 1.6.1 release assets. The script waits for glyph-specific CHTML CSS to
load before measuring fixed-size delimiters; missing or misaligned delimiters
still fail the check.

OMML copying currently produces XML text, not a native Office clipboard object.
A successful Core conversion does not establish editable equation pasting into
Word, PowerPoint, WPS or mobile Office.

## Reproduce safely

Save any working drafts first. Use a test vault and explicitly authorize the
device. Select the device and its Obsidian WebView socket; never assume another
app's WebView is the correct target.

```powershell
adb devices -l
adb -s <device> shell cat /proc/net/unix
adb -s <device> forward tcp:9225 localabstract:<obsidian-webview-socket>
$env:OBSIDIAN_QA_CDP_URL = 'http://127.0.0.1:9225'
$env:OBSIDIAN_QA_REAL_DEVICE = '1'
node scripts/obsidian-conversion-qa.cjs
node scripts/obsidian-settings-qa.cjs
$env:OBSIDIAN_QA_ADB = '<absolute-path-to-adb.exe>'
$env:OBSIDIAN_QA_ADB_SERIAL = '<device>'
node scripts/obsidian-android-qa.cjs
node scripts/obsidian-matrix-qa.cjs
$env:OBSIDIAN_QA_THEME = 'dark'
node scripts/obsidian-matrix-qa.cjs
Remove-Item Env:OBSIDIAN_QA_THEME
adb -s <device> forward --remove tcp:9225
```

Run scripts sequentially in a WebView. Matrix theme checks temporarily change
body classes and restore them; they do not persist the host theme preference.
If rotating a device for a test, record and restore its original rotation mode.
Remove only forwards created for testing. Do not reset app storage or replace
plugin `data.json` to fix a test failure.

Local evidence is written under ignored `output/playwright/` as cropped owned
dialog screenshots and JSON reports. Inspect both images and geometry; a
non-empty preview or an unchanged zoom label is not rendering acceptance. Review
screenshots for private content before sharing them in an issue.
