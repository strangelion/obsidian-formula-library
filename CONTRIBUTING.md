# Contributing

Thanks for helping improve Formula Library.

## Development

This repository keeps the Obsidian release assets in the repo root. Obsidian community plugin installs download the release assets `manifest.json`, `main.js`, and `styles.css`, so runtime code must not depend on files that are only present in the development tree unless those files are bundled into one of those release assets.

Before opening a pull request:

- Run a syntax check for `main.js` with Node.js.
- Keep release assets self-contained.
- Avoid adding network access unless the feature absolutely requires it and the behavior is documented.
- Do not commit secrets, tokens, personal data, or local vault paths.

## Release

Use the GitHub Actions release workflow and provide a version without the `v` prefix. The workflow updates `manifest.json`, creates the tag, attests release assets, and uploads the files Obsidian downloads.