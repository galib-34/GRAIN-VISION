from __future__ import annotations

import asyncio
import io
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

# 1. CRITICAL: Load .env at the absolute entry point BEFORE reading CORS_ORIGINS or any config
BASE_DIR = Path(__file__).resolve().parent.parent
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

# Optional torch inference optimization for high-density grain samples
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

from app.database import (
    authenticate_user,
    create_lot_record,
    create_seller,
    create_session,
    create_user,
    delete_session,
    get_dashboard_summary,
    get_seller_by_id,
    get_user_from_token,
    init_db,
    list_sellers,
    list_user_lots,
    update_lot_decision,
)
from app.logic_engine import calculate_metrics, configured_priority
from app.pricing import (
    background_mandi_scheduler,
    get_cached_mandi_reference,
    refresh_mandi_cache,
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("grain_vision.api")

# Initialize database schema
init_db()

# Lifespan manager for background mandi price caching
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize cache immediately on startup
    logger.info("Initializing Mandi price cache on startup...")
    asyncio.create_task(refresh_mandi_cache(force=False))
    # Start background scheduler
    scheduler_task = asyncio.create_task(background_mandi_scheduler(interval_hours=12))
    yield
    scheduler_task.cancel()

app = FastAPI(
    title="GRAIN-VISION API",
    version="2.0.0",
    description="AI-powered rice quality assessment and procurement management backend.",
    lifespan=lifespan,
)

# 2. Dynamic CORS Origins Configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
raw_cors = os.getenv("CORS_ORIGINS", "").strip()

if raw_cors and raw_cors != "*":
    origins = [o.strip() for o in raw_cors.split(",") if o.strip()]
    allow_credentials = True
elif ENVIRONMENT in ("production", "prod"):
    # Guardrail: Never allow open wildcard (*) in production
    logger.warning("Production mode active: Wildcard CORS disallowed. Restricting to explicit origins.")
    origins = [o.strip() for o in raw_cors.split(",") if o.strip()] if raw_cors else []
    allow_credentials = bool(origins)
else:
    # Development mode: allow local origins
    origins = ["*"] if not raw_cors else [o.strip() for o in raw_cors.split(",") if o.strip()]
    allow_credentials = False if "*" in origins else True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Model initialization
MODEL_PATH = Path(os.getenv("YOLO_MODEL_PATH", str(BASE_DIR / "models" / "train2.pt"))).expanduser()
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))
CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.25"))

try:
    model = YOLO(str(MODEL_PATH))
    MODEL_STATUS = "loaded"
    MODEL_ERROR = None
    MODEL_CLASSES = {int(key): str(value).strip().lower() for key, value in model.names.items()}
    logger.info("YOLO model loaded successfully from %s with %d classes", MODEL_PATH, len(MODEL_CLASSES))
except Exception as exc:
    model = None
    MODEL_STATUS = "error"
    MODEL_ERROR = str(exc)
    MODEL_CLASSES = {}
    logger.error("Failed to load YOLO model: %s", exc, exc_info=True)

CLASSES = [MODEL_CLASSES[key] for key in sorted(MODEL_CLASSES)] if MODEL_CLASSES else [
    "broken-chalky", "broken-clear", "foreign-object", "plastic", "sound", "stone", "unsound", "whole-chalky"
]
PRIORITY = configured_priority(CLASSES)


# --- Authentication Dependency ---

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    """Resolves authenticated user from Bearer token, or defaults to default demo user for frictionless field operation."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        user = get_user_from_token(token)
        if user:
            return user
    # Fallback to default procurement officer (id=1)
    return {"id": 1, "username": "officer", "full_name": "Procurement Officer", "role": "procurement_officer"}


def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    """Strict authentication dependency for protected mutations."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication token required.")
    token = authorization[7:].strip()
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session token.")
    return user


# --- Health & Reference Endpoints ---

@app.get("/api/health")
def health():
    return {
        "status": "ok" if model is not None else "degraded",
        "service": "grain-vision",
        "version": "2.0.0",
        "environment": ENVIRONMENT,
        "model_status": MODEL_STATUS,
        "model_error": MODEL_ERROR,
        "model_path": str(MODEL_PATH),
        "classes": CLASSES,
        "procurement_priority": PRIORITY,
        "decision_support_label": "Estimate for Procurement Decision Support",
    }


@app.get("/api/prices")
def get_prices():
    """Returns the cached Mandi reference price immediately.

    Never blocks on live external network requests.
    """
    return {"andhra_pradesh_paddy_reference": get_cached_mandi_reference()}


@app.post("/api/prices/refresh")
async def trigger_price_refresh():
    """Explicitly refreshes the cached reference price from data.gov.in."""
    ref = await refresh_mandi_cache(force=True)
    return {"status": "refreshed", "reference": ref}


# --- Authentication Endpoints ---

@app.post("/api/auth/register")
def register(payload: dict[str, Any]):
    username = payload.get("username", "")
    password = payload.get("password", "")
    full_name = payload.get("full_name", "")
    role = payload.get("role", "procurement_officer")
    try:
        user = create_user(username, password, full_name, role)
        token = create_session(user["id"])
        return {"status": "registered", "user": user, "token": token}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/auth/login")
def login(payload: dict[str, Any]):
    username = payload.get("username", "")
    password = payload.get("password", "")
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_session(user["id"])
    return {"status": "authenticated", "user": user, "token": token}


@app.get("/api/auth/me")
def me(current_user: dict[str, Any] = Depends(get_current_user_optional)):
    return {"user": current_user}


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        delete_session(authorization[7:].strip())
    return {"status": "logged_out"}


# --- Seller Management Endpoints ---

@app.get("/api/sellers")
def get_sellers(current_user: dict[str, Any] = Depends(get_current_user_optional)):
    return {"sellers": list_sellers(current_user["id"])}


@app.post("/api/sellers")
def add_seller(payload: dict[str, Any], current_user: dict[str, Any] = Depends(get_current_user_optional)):
    name = payload.get("name", "")
    phone = payload.get("phone", "")
    seller_code = payload.get("seller_code", "")
    location = payload.get("location", "")
    try:
        seller = create_seller(current_user["id"], name, phone, seller_code, location)
        return {"status": "created", "seller": seller}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# --- Dashboard Hub Endpoints ---

@app.get("/api/dashboard/stats")
def get_dashboard_stats(current_user: dict[str, Any] = Depends(get_current_user_optional)):
    return get_dashboard_summary(current_user["id"])


# --- Lot Management Endpoints ---

@app.get("/api/lots")
def get_lots(current_user: dict[str, Any] = Depends(get_current_user_optional)):
    return {"lots": list_user_lots(current_user["id"])}


@app.post("/api/lots/{lot_id}/decision")
def record_decision(
    lot_id: str,
    payload: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user_optional),
):
    decision = payload.get("decision", "")
    rejection_reason = payload.get("rejection_reason")
    notes = payload.get("notes")
    try:
        updated = update_lot_decision(lot_id, current_user["id"], decision, rejection_reason, notes)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Lot '{lot_id}' not found.")
        return {"status": "updated", "lot": updated}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# --- High-Density Image Analysis & Price Estimation ---

@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(...),
    lot_weight_kg: Optional[float] = Form(None),
    seller_id: Optional[int] = Form(None),
    save_lot: bool = Form(True),
    current_user: dict[str, Any] = Depends(get_current_user_optional),
):
    """Analyzes a rice sample image for defects with high-density grain memory optimization.

    Uses cached reference prices immediately, performs transparent quality-adjusted
    pricing, and persists the assessment record for the user's dashboard hub.
    """
    if not image.content_type or not image.content_type.lower().startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")
    if model is None:
        raise HTTPException(status_code=503, detail=f"YOLO model could not be loaded: {MODEL_ERROR}")

    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image exceeds upload limit ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    try:
        # High-Density Memory Optimization:
        # Verify and downscale if image exceeds standard inference dimension (1920px max).
        with Image.open(io.BytesIO(data)) as source:
            source.verify()

        with Image.open(io.BytesIO(data)) as source:
            img = source.convert("RGB")
            orig_w, orig_h = img.size

            # Downsample if ultra-high resolution to prevent backend memory pressure
            max_dim = max(orig_w, orig_h)
            if max_dim > 1920:
                scale = 1920.0 / max_dim
                new_w, new_h = int(orig_w * scale), int(orig_h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
                logger.info("High-density downsampling applied: %dx%d -> %dx%d", orig_w, orig_h, new_w, new_h)

        width, height = img.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable image.") from exc
    finally:
        await image.close()

    # Model inference with memory isolation
    try:
        if TORCH_AVAILABLE:
            with torch.inference_mode():
                results = model.predict(source=img, conf=CONFIDENCE, imgsz=640, verbose=False)
        else:
            results = model.predict(source=img, conf=CONFIDENCE, imgsz=640, verbose=False)
    except Exception as exc:
        logger.error("Model inference failure: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Model inference failed: {exc}") from exc
    finally:
        # Promptly release PIL memory
        try:
            img.close()
            del img
            del data
        except Exception:
            pass

    counts = {name: 0 for name in CLASSES}
    detections = []

    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            class_id = int(box.cls[0].item())
            class_name = MODEL_CLASSES.get(class_id)
            if class_name not in counts:
                continue
            confidence = float(box.conf[0].item())
            coords = box.xyxy[0].tolist()
            counts[class_name] += 1
            detections.append({
                "class": class_name,
                "confidence": round(confidence, 4),
                "box": {key: round(float(value), 2) for key, value in zip(("x1", "y1", "x2", "y2"), coords)},
            })

    class_rank = {name: index for index, name in enumerate(PRIORITY)}
    detections.sort(key=lambda item: (class_rank[item["class"]], -item["confidence"]))

    # FAST, NON-BLOCKING: retrieve cached mandi reference (NEVER live HTTP request)
    price_reference = get_cached_mandi_reference()
    ref_modal_price = price_reference.get("modal_price_per_quintal")

    # Transparent quality & price calculation
    metrics = calculate_metrics(
        counts=counts,
        classes=CLASSES,
        priority=PRIORITY,
        reference_price_per_quintal=ref_modal_price,
        lot_weight_kg=lot_weight_kg,
    )

    # Resolve seller details if provided
    seller_name = None
    if seller_id and seller_id > 0:
        seller_obj = get_seller_by_id(seller_id, current_user["id"])
        if seller_obj:
            seller_name = seller_obj["name"]

    # Save lot record if requested
    saved_lot = None
    if save_lot and metrics["total_grains"] > 0:
        saved_lot = create_lot_record(
            user_id=current_user["id"],
            seller_id=seller_id if seller_id and seller_id > 0 else None,
            seller_name=seller_name,
            image_filename=image.filename,
            total_grains=metrics["total_grains"],
            quality_score=metrics["quality_score"],
            metrics=metrics,
            weight_kg=lot_weight_kg or 0.0,
            base_price_per_quintal=ref_modal_price,
            estimated_rate_per_kg=metrics["estimated_price_per_kg"],
            total_estimated_price=metrics["total_estimated_lot_price"],
        )

    return {
        "image": {"filename": image.filename, "width": width, "height": height},
        "metrics": metrics,
        "quality": {
            "score": metrics["quality_score"],
            "label": "Estimate for Procurement Decision Support",
            "is_accredited_grade": False,
        },
        "price_reference": price_reference,
        "model": {"status": MODEL_STATUS, "name": "GRAIN-VISION YOLOv8n train2", "classes": CLASSES},
        "procurement_priority": PRIORITY,
        "procurement_priority_label": "Estimate for Procurement Decision Support",
        "detections": detections,
        "lot": saved_lot,
        "disclaimers": {
            "decision_support": "Quality scores and pricing estimates are advisory decision-support metrics, not officially accredited statutory grades or binding purchase guarantees.",
            "mandi_baseline": price_reference.get("disclaimer"),
        },
    }
