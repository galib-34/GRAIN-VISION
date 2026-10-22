"""Production-ready launcher for GRAIN-VISION FastAPI backend.
Replaces dev reload commands with multi-worker execution, configurable SSL, and robust signal handling.
"""
from __future__ import annotations

import os
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WORKERS", "2"))
    ssl_keyfile = os.getenv("SSL_KEYFILE", None)
    ssl_certfile = os.getenv("SSL_CERTFILE", None)

    print(f"🌾 Starting GRAIN-VISION Production Server on {host}:{port} with {workers} workers...")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        workers=workers,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        access_log=True,
        timeout_keep_alive=120,
    )
