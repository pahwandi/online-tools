# Hari Pahwandi — Online Tools

Free, privacy-friendly online tools. Every tool runs entirely in your browser — nothing is uploaded to a server.

## Tools

**JSON**

- [JS Object to JSON](/js-object-to-json) — convert a JS object literal to valid, formatted JSON.
- [JSON Formatter](/json-formatter) — prettify, minify, and validate JSON with syntax highlighting.
- [JSON to CSV](/json-to-csv) — convert an array of JSON objects to CSV with nested flattening.

**Image**

- [EXIF Stripper](/exif-stripper) — view and remove hidden metadata (EXIF, GPS, XMP); lossless for JPEG/PNG.
- [Image Compressor](/image-compressor)
- [Image Cropper](/image-cropper)
- [Image Format Converter](/image-converter)
- [Image Resizer](/image-resizer)
- [Image to Data URI](/image-to-data-uri) — base64 data URI with CSS/HTML snippets and URL-encoded SVG output.
- [Image to Favicon](/image-to-favicon)
- [Image Watermark](/image-watermark)

**Dev Misc**

- [Code Minifier & Formatter](/code-minifier)
- [Color Converter](/color-converter)
- [Cron Generator](/cron-generator) — build a cron expression from a form.
- [Cron Parser](/cron-parser) — explain a cron expression, validate fields, preview next runs.
- [CSS Gradient Generator](/gradient-generator)
- [JWT Decoder](/jwt-decoder) — decode header/payload, read claims, verify HMAC signatures locally.
- [Regex Tester](/regex-tester) — live match highlighting, capture groups, replace preview.
- [Unix Timestamp Converter](/timestamp-converter)

## Tech stack

- [Solid 2.0](https://solidjs.com) + [`@solidjs/router`](https://github.com/solidjs/solid-router)
- [`@solidjs/vite-plugin`](https://github.com/solidjs/vite-plugin) (turnkey client mode — no `index.html`, no mount file)
- [Tailwind CSS 4](https://tailwindcss.com) via `@tailwindcss/vite`
- [Iconify](https://iconify.design) icons (MDI) via `unplugin-icons`
- Google Analytics

## Getting started

```bash
pnpm install   # or npm install / yarn install
pnpm dev       # start the dev server
```

Open http://localhost:8091.

## Structure

```
src/
  App.tsx                 # root component: router + layout
  Document.tsx            # document shell (the "index.html") — head tags live here
  consts.ts               # site metadata, tool catalog, GA id
  router.ts               # route table
  pages/                  # one file per tool + Home / NotFound
  components/             # Header, Footer, BaseLayout, Dropzone, Section
  lib/                    # shared image + UI helpers
  styles/global.css       # Tailwind entry
```

## Available scripts

| Script           | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `pnpm dev`       | Start the dev server (http://localhost:8091).          |
| `pnpm build`     | Build the static site to `dist/client`.                |
| `pnpm serve`     | Preview the production build locally.                  |
| `pnpm lint`      | Lint `src/` with oxlint.                               |

## Deployment

`vite build` emits a purely static site — deploy `dist/client` to any static host.

## The `ssr` flip

Streaming SSR is one boolean: add `ssr: true` next to `start: true` in `vite.config.ts`. `src/App.tsx` and `src/Document.tsx` carry over unchanged — `<HydrationScript />` is already in place in the Document (in client mode it is stripped from the static shell). The build then emits a request handler to `dist/server` instead of a purely static site.
