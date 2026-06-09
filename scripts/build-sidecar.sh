#!/usr/bin/env bash
# Build the standalone Yanshi Runtime sidecar binary and stage it for Tauri
# bundling. The produced binary runs the FastAPI/uvicorn runtime without any uv
# project or repository checkout.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/runtime/python"

uv run --group dev pyinstaller --noconfirm --clean --onefile \
  --name yanshi-runtime-sidecar \
  --distpath dist/sidecar --workpath build/sidecar --specpath build/sidecar \
  --collect-submodules uvicorn \
  --collect-submodules yanshi_runtime \
  --collect-all langgraph \
  --collect-all langgraph_checkpoint \
  --collect-all langgraph_checkpoint_sqlite \
  --hidden-import aiosqlite \
  sidecar_main.py

DEST="$ROOT/apps/desktop/src-tauri/resources"
mkdir -p "$DEST"
cp "dist/sidecar/yanshi-runtime-sidecar" "$DEST/yanshi-runtime-sidecar"
chmod +x "$DEST/yanshi-runtime-sidecar"
echo "Sidecar staged at $DEST/yanshi-runtime-sidecar"
