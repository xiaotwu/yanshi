# Atelier Worker Assets

This directory is reserved for richer Yanshi Atelier worker assets.

Expected layout:

```txt
manager/
reviewer/
browser/
computer/
file/
terminal/
```

Supported asset types are intended to include SVG, PNG sprite sheets, Lottie, and glTF. Assets are
registered through `workerCharacterRegistry` in `src/characters.ts`; when an asset is available,
the renderer can prefer it over the procedural fallback.

The directory is currently empty by design. Worker roles render through the procedural character
system unless a real asset is registered.
