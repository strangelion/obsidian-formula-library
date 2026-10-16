# Core integration reference

Formula Library 1.6.3 uses conversion-only LaTeXSnipper Core 3.2.1
at `d31ae02`, replacing the `eeca342` pin in Formula Library 1.6.1.
Current binary/Worker verification date: 2026-10-16. The upstream version string
is unchanged; the source commit and hashes identify this upgrade.

## Fixed source and distribution

- Core 3.2.1 at `d31ae028c44ad39be44ecb73abe3f2e15b339b6a`.
- Conversion-only web profile, Rust 1.99.1, wasm-pack 0.13.1 and its matched
  wasm-bindgen 0.2.126. No OCR models or recognition runtime.
- WASM: 2,584,487 bytes; SHA-256
  `d6ec2397f0c5ec762f24d109e660527e1375c97ccbd72411dd08eee690429c1a`.
- Glue: 24,544 bytes; SHA-256
  `f3b406954deec72f1615663fce4a5e2f9bcaa5f630f6432db968231c021c1b1e`.
- [Asset manifest](../vendor/core/manifest.json) fixes all vendored hashes.
  [Exact source archive](../vendor/core/source-d31ae02.tar.gz) contains preferred
  Rust/TS source, Cargo/npm locks and build scripts. Ten readable TS files
  preserve the unmodified official client/Worker and protocol helpers.
- Combined distribution: AGPL-3.0-only, retaining original MIT and dependency
  notices. See [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

`scripts/build-core-assets.mjs` checks hashes and conversion-only WASM exports,
bundles the official Worker, and writes ignored `src/generated/core-payload.js`.
The build embeds Worker/glue/WASM and license texts into `main.js`; only
`obsidian` is external. Installation still needs just `main.js`, `manifest.json`
and `styles.css`. The 6.87 MB source archive is not embedded in the runtime.
Generated main.js is about 4.83 MiB including base64 WASM, existing MathLive/data
and license texts; the raw WASM size is not the installed JavaScript size.
The normal dependency inventory has 55 entries. The current upstream slim build
also contains additive completion, registry and preference exports; their official
JS dependencies are retained unmodified, but this adapter exposes only conversion.
No completion/preference UI, persistence, host consent or third-party backend is
enabled by this upgrade. Formula Library 1.6.3 exposes the bounded AsciiMath and
UnicodeMath routes from this same binary; no additional runtime is downloaded.

## Modules, protocol and lifecycle

- `src/core-assets.js`: lazy SHA-256 validation and internally created Blob
  URLs for WASM, raw ESM glue, metadata bridge and module Worker. Note text and
  settings cannot supply a module URL. The exact WASM URL is passed explicitly.
- A proxy filters uniquely tagged capability/API metadata before forwarding
  official protocol-v1 replies; the official client rejects unsolicited IDs.
  Generation guards apply during recovery too. Host CSP is not changed.
- `src/core-conversion.js`: injected factory, v3 capability envelope, strict
  default only for API callers omitting mode, validated result/route, 64 KiB UTF-8 input, 256 KiB serialized result,
  queue length 8 and 30-second total deadline including initialization/wait.
- Active cancellation hard-terminates the session/recovery Worker before Blob
  revocation. Queued cancellation removes only that job. Slow factories and
  blocked Worker constructors are cleaned up. Retry is manual, never automatic.
- `src/conversion.js`: source/output separation, revisions, diagnostics,
  cancellable work and manual draft confirmation. XML is textarea/text, not
  executable HTML. Bare LaTeX needs `contentKind: latex-fragment` and a successful
  MathJax preview to enable editor use. No automatic note replacement.
- `src/plugin.js`: lazy service and unload cleanup. The editor callback refuses
  to insert into a draft that changed while the conversion dialog was open.

Workers allow hard cancellation; they are **not** a general security sandbox.
Blocked module Workers, Blob imports, WASM or integrity verification produce
an unavailable status without disabling ordinary LaTeX editing. There is no
main-thread conversion fallback, remote service or runtime downloader.

## Actual format boundary

Inputs: one LaTeX, Typst, MathML, OMML, AsciiMath or UnicodeMath formula.
Outputs: checked bare LaTeX, Typst, MathML, OMML, AsciiMath or UnicodeMath text.
Capability `available` and `mode`, not enum
membership, control availability. The pinned registry has 176 rows but only
78 available routes overall; the narrower UI exposes 36 best-effort combinations
and one strict route, not 176 supported conversions.

AsciiMath/UnicodeMath use a finite linear grammar and canonical serialization.
They do not cover every dialect, arbitrary AST structures, rich text, fonts,
spacing or Word equation build-up. Unsupported syntax/structures are rejected,
not silently repaired or retried with another mode. Linear output is copyable
plain text, never treated as a LaTeX draft or an Office clipboard object.

The UI defaults to best-effort and always sends the displayed mode explicitly.
Strict is user-selectable, supports only the accepted LaTeX→OMML subset and
never silently falls back. Conversion and output use remain manual.
`latex-fragment` uses the registered `latex_display` route
and bounded bare-formula projection, not regex document stripping. Full-document
`latex` output is not sent to MathLive. Neither mode guarantees source recovery,
visual identity or lossless round trips. Renderer support is independent.
OMML XML is not Word-native clipboard/OLE. On Windows only, the optional
**Copy for Word** action copies standalone MathML text built from the OMML or
MathML result (OMML is converted first) for Word's own importer; it is not an
OLE object and is verified against Windows Word only.

No OCR/models, whole-document/vault conversion, third-party provider API,
native Node addon, MTEF semantic import, TikZ compilation, or
Office/PDF document generation is included.
MTEF has an upstream experimental read-only raw-byte inspector; its conversion
capabilities remain unavailable and it is not shown as a source format.

## Verification and known limitations

The Node/Chrome and Windows Obsidian conversion checks below were rerun for
1.6.3 on 2026-10-16. Word checks cover 1.6.2 with the same `d31ae02` binary.
Android checks remain historical
1.6.1 / `eeca342` evidence, not acceptance of the new Core on mobile.
Expand **Core information** in the conversion dialog for the bundled version,
full source commit, build date, profile and WASM SHA-256. These are bundled
build metadata, not a claim that initialization or a conversion has succeeded;
the task status and diagnostics report runtime outcomes separately.

| Environment | Evidence / boundary |
| --- | --- |
| Node | 70 regressions, including hash-verified vendored WASM checks for linear import/export, canonical grouping, unsupported syntax and MTEF gating, Typst adjacent/nested operands, explicit min/max limits, structural middle delimiters and OMML fragment tails; service lifecycle/validation checks, plugin unload protection and tool preferences |
| Real Chrome Worker | All 36 exposed best-effort combinations and four conversion regression cases, strict and MTEF rejection/OMML, DTD rejection, UTF-8 bounds, blocked-constructor cleanup; test-only infinite WASM loop hard cancel/timeout and real Core recovery; zero conversion network requests |
| Isolated browser UI | Manual modes, stale output, plain XML, preview error gate, retry, en/zh, 1280/390 px and large-text bounds; mocked host/MathJax |
| Windows Obsidian app:// | Retested 1.6.3: actual Core loading, 12 linear-input routes, unsupported-syntax rejection, Typst→LaTeX MathJax preview, strict LaTeX→OMML text, limits/original protection, explicit draft opening without note writes, en/zh and 1280/390 px geometry, including expanded Core metadata. In 1.6.2, all 16 light/dark CHTML matrix geometry cases passed, including triangular input; Copy for Word produced editable Word OMath for a Greek fraction, superscript and matrix on Word 16.0, keeping source and OMML output unchanged. Not OLE, PowerPoint, WPS or mobile Office acceptance |
| Android phone / tablet | Historical 1.6.1 Core only: real Android 16 WebViews on 2211133C / Obsidian 1.14.4 and 24018RPACC / Obsidian 1.13.8: simple samples across all 16 exposed best-effort combinations, conversion UI/settings, native touch controls, editor/library layout, matrix/parameter previews, Mermaid navigation/history and plots. Development fixes additionally passed 12 matrix geometry cases per tested orientation/theme with MathJax 3.2.2 / 4.1.3. Not a retest of the new binary. See [Android verification](ANDROID-TESTING.md) for scope |
| iOS and other mobile hosts | Not tested; Android results and desktop portrait checks are not universal mobile acceptance |
| General formula fidelity | Not certified; simple examples do not prove all syntax or complete round trips |

Run `npm run check`, then `npm run test:ui` with installed Playwright Chromium
or `FORMULA_TEST_BROWSER_PATH`. `scripts/verify-conversion-ui.cjs` also covers
the Word clipboard payload builder with mocked host/MathJax; the real Windows
Word import is checked separately by `scripts/obsidian-word-clipboard-qa.cjs`,
which needs a user-opened Obsidian and an installed Word.
`scripts/obsidian-conversion-qa.cjs` attaches to
a user-approved local Obsidian debug endpoint on port 9223. It owns its dialogs,
cloned settings, service and in-memory note. `--no-screenshots` skips native
Electron frame capture, not interaction checks. Browser screenshots are under
`output/playwright/`.

## Reproduce or upgrade deliberately

Ordinary builds need Node/npm and vendored assets, not Rust or a Core checkout.
Extract the pinned source archive and run in its Core directory to rebuild:

```sh
wasm-pack build crates/wasm --target web --release --out-dir ../../target/wasm-conversion-web --locked --no-default-features --features conversion-only
```

Use wasm-pack's matched wasm-bindgen, not an unrelated global CLI. Before
updating `vendor/core`, recheck source, profile, exports, hashes and licenses.
`scripts/collect-core-licenses.mjs <clean pinned Core checkout>` generates a
license inventory from the slim normal dependency closure, including compile-time
macros; it is not a claimed binary SPDX SBOM. Never silently refresh a checksum
when verification fails.

For defects, provide plugin/Core/Obsidian versions, OS/theme, source/output,
mode, error code and a sanitized single-formula expected/actual example.
Preserve the original; do not share private paths/raw backups. Confirmed parser
defects can be forwarded to Core with fixtures. UI, lifecycle, loading and
insertion stay with this adapter. No automatic diagnostic upload exists.
