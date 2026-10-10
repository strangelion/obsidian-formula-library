# Core integration reference

Single-formula conversion in Formula Library 1.6.0 uses the conversion-only
LaTeXSnipper Core 3.2.1 package. Verification date: 2026-10-10.

## Fixed source and distribution

- Core 3.2.1 at `eeca3421e28afde07f3d5d6fd486a4220e93ebe8`.
- Conversion-only web profile, Rust 1.96.0, wasm-pack 0.13.1 and its matched
  wasm-bindgen 0.2.126. No OCR models or recognition runtime.
- WASM: 1,752,764 bytes; SHA-256
  `9c6ce4143bee2558ffa254777bdebb081f555fd629af6165c9bffd1b155352fe`.
- Glue: 11,238 bytes; SHA-256
  `96993517ca1cfd0d697b9af213b4914470e8a3e3e01856d669648951d7d0e610`.
- [Asset manifest](../vendor/core/manifest.json) fixes all vendored hashes.
  [Exact source archive](../vendor/core/source-eeca342.tar.gz) contains preferred
  Rust/TS source, Cargo/npm locks and build scripts. Five readable TS files
  preserve the unmodified official client/Worker and protocol helpers.
- Combined distribution: AGPL-3.0-only, retaining original MIT and dependency
  notices. See [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md).

`scripts/build-core-assets.mjs` checks hashes and conversion-only WASM exports,
bundles the official Worker, and writes ignored `src/generated/core-payload.js`.
The build embeds Worker/glue/WASM and license texts into `main.js`; only
`obsidian` is external. Installation still needs just `main.js`, `manifest.json`
and `styles.css`. The 6.34 MB source archive is not embedded in the runtime.
Generated main.js is about 3.73 MiB including base64 WASM, existing MathLive/data
and license texts; the raw WASM size is not the installed JavaScript size.

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

Inputs: one LaTeX, Typst, MathML or OMML formula. Outputs: checked bare LaTeX,
Typst, MathML or OMML text. Capability `available` and `mode`, not enum
membership, control availability. The pinned registry has 144 rows but only
46 available routes overall; the narrower UI exposes 16 best-effort combinations
and one strict route, not 144 supported conversions.

The UI defaults to best-effort and always sends the displayed mode explicitly.
Strict is user-selectable, supports only the accepted LaTeX→OMML subset and
never silently falls back. Conversion and output use remain manual.
`latex-fragment` uses the registered `latex_display` route
and bounded bare-formula projection, not regex document stripping. Full-document
`latex` output is not sent to MathLive. Neither mode guarantees source recovery,
visual identity or lossless round trips. Renderer support is independent.
OMML XML is not Word-native clipboard/OLE.

No OCR/models, whole-document/vault conversion, third-party provider API,
native Node addon, UnicodeMath/AsciiMath/MTEF import, TikZ compilation, or
Office/PDF document generation is included.

## Verification and known limitations

| Environment | Evidence / boundary |
| --- | --- |
| Node | 63 regressions, including 19 service lifecycle/validation checks, plugin unload protection and tool preferences |
| Real Chrome Worker | Simple samples across all 16 exposed best-effort combinations, strict rejection/OMML, DTD rejection, UTF-8 bounds, blocked-constructor cleanup; test-only infinite WASM loop hard cancel/timeout and real Core recovery |
| Isolated browser UI | Manual modes, stale output, plain XML, preview error gate, retry, en/zh, 1280/390 px and large-text bounds; mocked host/MathJax |
| Windows Obsidian app:// | Actual Core loading, Typst→LaTeX MathJax preview, strict LaTeX→OMML text, limits/original protection, explicit draft opening without note writes, en/zh and 1280/390 px geometry |
| Android / iOS | **Not tested on real devices**; desktop portrait is not mobile acceptance |
| General formula fidelity | Not certified; simple examples do not prove all syntax or complete round trips |

Run `npm run check`, then `npm run test:ui` with installed Playwright Chromium
or `FORMULA_TEST_BROWSER_PATH`. `scripts/obsidian-conversion-qa.cjs` attaches to
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
