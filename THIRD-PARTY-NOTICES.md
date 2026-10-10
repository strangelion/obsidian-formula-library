# Distribution notices

The combined distribution containing LaTeXSnipper Core is licensed under
AGPL-3.0-only; see [LICENSE](LICENSE). The original plugin portions retain their
[MIT copyright and permission notice](LICENSES/Formula-Library-MIT-1.5.0.txt).
Historical MIT releases through 1.5.0 are unchanged.

- LaTeXSnipper Core 3.2.1, conversion-only profile, source revision
  `eeca3421e28afde07f3d5d6fd486a4220e93ebe8`: AGPL. The exact upstream source
  archive is [vendor/core/source-eeca342.tar.gz](vendor/core/source-eeca342.tar.gz),
  also available from the [pinned upstream commit](https://github.com/strangelion/latexsnipper-core/tree/eeca3421e28afde07f3d5d6fd486a4220e93ebe8).
  Its [NOTICE](vendor/core/NOTICE), [build dependency inventory](vendor/core/dependencies.json),
  and [collected dependency licenses](vendor/core/THIRD-PARTY-LICENSES.txt) are preserved.
  This inventory includes compile-time procedural macros, not a binary SPDX SBOM.
  No OCR models are included.
- MathLive 0.104.0: [MIT notice](LICENSES/MathLive-MIT.txt).
- KaTeX fonts distributed with MathLive: [MIT notice](LICENSES/KaTeX-MIT.txt).

Preferred integration source is under `src/`, `scripts/`, and
`vendor/core/runtime-src/`. The archived Core includes Rust/TypeScript sources,
Cargo/npm lockfiles and upstream build scripts. The plugin build uses the fixed
vendored assets and never fetches a moving upstream branch. See
[the integration reference](docs/CORE-INTEGRATION.md) for reproduction and hashes.

The installer still needs only `main.js`, `manifest.json`, and `styles.css`.
The generated JavaScript retains license texts; source archives and this notice
are supplied through the project repository/source download, not executed on
the user's device. A Core version upgrade requires a deliberate source and
provenance update, not an automatic dependency download.
