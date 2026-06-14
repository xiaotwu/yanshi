# Atelier worker assets

Future home for rich worker character assets, one directory per role:

```txt
manager/  reviewer/  browser/  computer/  file/  terminal/
```

Supported types (see docs/YANSHI_ATELIER_WORKER_DESIGN.md §2.7): `svg`, `sprite` (PNG sheet),
`lottie`, `gltf`. Assets are wired through `workerCharacterRegistry` in `src/characters.ts` —
register a state's `{ source, path }` and the renderer will prefer it over the procedural
fallback once a loader for that type exists.

**Currently empty by design.** Every role renders through the procedural chibi system
(`assetType: "procedural"`); nothing here is mocked or pre-claimed.
