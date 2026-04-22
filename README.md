# VSCode PDF Viewer

Open `.pdf` files directly inside VS Code.

This extension uses Mozilla `pdf.js` and integrates it into a VS Code custom editor so PDF files can be previewed without leaving the editor.

## Features

- Open PDF files in a built-in preview
- Auto-reload when the file changes on disk
- Document outline, thumbnails, and find-in-document
- Configurable default zoom, sidebar, cursor, scroll mode, and spread mode
- Works in untrusted workspaces

## Settings

Available settings:

- `pdf-preview.default.cursor`
  - `select` or `hand`
- `pdf-preview.default.scale`
  - `auto`, `page-actual`, `page-fit`, `page-width`, or a numeric scale such as `1.25`
- `pdf-preview.default.sidebar`
  - show or hide the sidebar on load
- `pdf-preview.default.scrollMode`
  - `vertical`, `horizontal`, or `wrapped`
- `pdf-preview.default.spreadMode`
  - `none`, `odd`, or `even`

## Notes

- This extension is focused on in-editor PDF viewing.
- Rendering and viewer behavior are provided by the bundled `pdf.js` distribution.
- Current bundled `pdf.js` version: `5.6.205`

## Known limitations

- Large or complex PDFs may still be heavy, depending on the document and your machine.
- This extension does not aim to replace a full desktop PDF editor.

## Maintainer notes

This extension does not build `pdf.js` from source. It vendors the upstream legacy distribution under `lib/` and adapts it for a VS Code webview.

The main integration points are:

- `src/pdfPreview.ts`
  - creates the webview
  - reads upstream `lib/web/viewer.html`
  - injects the VS Code CSP, `<base>` tag, runtime config, and `lib/main.js`
- `lib/main.js`
  - bridges the upstream viewer to the extension
  - applies the extension defaults for cursor, zoom, sidebar, scroll mode, and spread mode
  - configures asset URLs for `cmaps`, `standard_fonts`, `iccs`, and `wasm`
  - handles file reload while preserving viewer state as much as possible
- `lib/build/*` and `lib/web/*`
  - vendored upstream assets from the `pdf.js` legacy dist

### Notes on the 5.x migration

The jump from `pdf.js 3.x` to `5.6.205` is not a drop-in asset replacement.

The main changes are:

- the legacy dist is now ESM-based
  - `pdf.js` -> `pdf.mjs`
  - `pdf.worker.js` -> `pdf.worker.mjs`
  - `viewer.js` -> `viewer.mjs`
- viewer localization changed
  - `locale.properties` -> `locale.json`
  - per-locale files are now `viewer.ftl`
- additional runtime asset directories are required
  - `web/iccs`
  - `web/wasm`
- the upstream viewer UI and DOM structure changed significantly

Because of that, this extension no longer keeps a copied HTML template in TypeScript. It injects into the vendored upstream `viewer.html` at runtime.

### Upgrading pdf.js

1. Download the new legacy distribution zip from a `pdf.js` release.
1. Extract it.
1. Replace the vendored upstream assets:
   - overwrite `lib/build/*`
   - overwrite `lib/web/*`
1. Remove the upstream sample PDF:
   - delete `lib/web/compressed.tracemonkey-pldi-09.pdf`
1. Disable the upstream sample default in `lib/web/viewer.mjs`:
   - set `defaultOptions.defaultUrl.value` to `""`
1. Review the VS Code adaptation points:
   - `src/pdfPreview.ts`
   - `lib/main.js`
1. Rebuild and package:
   - `npm run compile`
   - `npm run package`

### What to verify after an upgrade

- the viewer loads with styling applied
- the document opens without using the upstream sample PDF
- the worker loads correctly
- text selection works
- find works
- reloading the file from disk refreshes the preview without a broken state
- fonts, CMaps, ICC profiles, and wasm-backed features resolve without missing-asset errors

## Credits

- Built on top of [Mozilla pdf.js](https://github.com/mozilla/pdf.js)
- Originally based on `tomoki1207/vscode-pdfviewer`
- The `pdf.js` 5.6.205 migration and version-bump work in this fork was carried out with assistance from Codex

## License

See [LICENSE](./LICENSE).
