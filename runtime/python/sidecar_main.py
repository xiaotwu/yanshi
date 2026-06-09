"""PyInstaller entry point for the standalone Yanshi Runtime sidecar.

This wraps :func:`yanshi_runtime.server.app.main` so PyInstaller has a concrete
script target. The produced binary runs the FastAPI/uvicorn runtime without any
uv project or repository checkout.
"""

from __future__ import annotations

import multiprocessing

from yanshi_runtime.server.app import main

if __name__ == "__main__":
    # Required so PyInstaller-frozen apps that spawn processes behave correctly.
    multiprocessing.freeze_support()
    main()
