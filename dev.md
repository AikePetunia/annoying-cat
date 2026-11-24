# Development

```bash
git clone https://github.com/AikePetunia/annoying-cat.git
cd annoying-cat
```

## Dev

```bash
npx web-ext run --devtools
```

## Build

```bash
npx web-ext lint --ignore-files temp.txt "*.md"
npx web-ext build --ignore-files temp.txt "*.md" web-ext-artifacts --overwrite-dest
```

The zip ends up in `web-ext-artifacts/`. Bump `"version"` in `manifest.json` before uploading a new one.
