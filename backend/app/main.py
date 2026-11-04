from __future__ import annotations

import asyncio
import io
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

# 1. CRITICAL: Load .env at the absolute entry point BEFORE reading CORS_ORIGINS or any config
BASE_DIR = Path(__file__).resolve().parent.parent
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
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
    get_or_create_google_user,
    get_lot_transaction_summary,
    get_seller_by_id,
    get_user_from_token,
    init_db,
    list_sellers,
    list_user_lots,
    list_lot_transactions,
    save_lot_transaction,
    update_lot_decision,
)
from app.models import GoogleTokenPayload, LotTransactionCreate
from app.logic_engine import calculate_metrics, configured_priority
from app.pricing import (
    FCI_SCREENING_DISCLOSURE,
    background_mandi_scheduler,
    evaluate_procurement_lot,
    get_cached_mandi_reference,
    refresh_mandi_cache,
    valuation_result_to_dict,
)
from app.quality_engine import (
    MODEL_CLASSES as QUALITY_MODEL_CLASSES,
    assess_grain_quality,
    map_class_to_category,
)
from app.procurement_engine import (
    COMPLIANCE_DISCLOSURE,
    evaluate_procurement,
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

@app.exception_handler(Exception)
async def sanitized_unhandled_exception_handler(request, exc: Exception):
    logger.error("Unhandled request error for %s %s", request.method, request.url.path, exc_info=(type(exc), exc, exc.__traceback__))
    return JSONResponse(status_code=500, content={"error": "INTERNAL_SERVER_ERROR", "message": "An unexpected server error occurred."})

# 2. Dynamic CORS Origins Configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_SIGN_IN_CONFIGURED = bool(GOOGLE_CLIENT_ID) and not GOOGLE_CLIENT_ID.lower().startswith(("your_actual_client_id_here", "your-google-oauth-client-id"))
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
    allow_origins=origins if origins else ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5050", "http://127.0.0.1:5050"],
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# In-process token buckets protect expensive inference and live price refresh.
_rate_buckets: dict[tuple[str, str], tuple[float, float]] = {}
_rate_lock = asyncio.Lock()
_RATE_LIMITS = {
    "/api/v1/analyze-grain": (5.0, 1.0 / 10.0),
    "/api/analyze": (5.0, 1.0 / 10.0),
    "/api/prices/refresh": (2.0, 1.0 / 60.0),
}

@app.middleware("http")
async def inference_rate_limit(request, call_next):
    policy = _RATE_LIMITS.get(request.url.path)
    if policy and request.method == "POST":
        capacity, refill_rate = policy
        client = request.client.host if request.client else "unknown"
        key = (client, request.url.path)
        now = time.monotonic()
        async with _rate_lock:
            tokens, updated = _rate_buckets.get(key, (capacity, now))
            tokens = min(capacity, tokens + (now - updated) * refill_rate)
            if tokens < 1:
                retry_after = max(1, int((1 - tokens) / refill_rate + 0.999))
                return JSONResponse(status_code=429, headers={"Retry-After": str(retry_after)}, content={"error": "RATE_LIMITED", "message": "Too many requests. Please try again shortly."})
            _rate_buckets[key] = (tokens - 1, now)
            if len(_rate_buckets) > 10_000:
                _rate_buckets.clear()
    return await call_next(request)

# Model initialization
MODEL_PATH = Path(os.getenv("YOLO_MODEL_PATH", str(BASE_DIR / "models" / "train2.pt"))).expanduser()
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(20 * 1024 * 1024)))
CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.25"))
MIN_VALID_GRAIN_DETECTIONS = 1
GRAIN_SAMPLE_CLASSES = {"broken-chalky", "broken-clear", "sound", "unsound", "whole-chalky"}

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

def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    """Require a valid bearer session for private procurement data and mutations."""
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
async def trigger_price_refresh(current_user: dict[str, Any] = Depends(get_current_user_required)):
    """Explicitly refreshes the cached reference price from data.gov.in."""
    ref = await refresh_mandi_cache(force=True)
    return {"status": "refreshed", "reference": ref}


# --- Authentication Endpoints ---

@app.post("/api/auth/register")
def register(payload: dict[str, Any], current_user: dict[str, Any] = Depends(get_current_user_required)):
    username = payload.get("username", "")
    password = payload.get("password", "")
    full_name = payload.get("full_name", "")
    # Registration cannot grant privileges supplied by a client payload.
    role = "procurement_officer"
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


@app.post("/api/auth/google")
def google_login(payload: GoogleTokenPayload):
    """Verify a Google ID token and issue the app's own revocable bearer session."""
    if not GOOGLE_SIGN_IN_CONFIGURED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured on this server.")
    try:
        claims = google_id_token.verify_oauth2_token(payload.token, GoogleRequest(), GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="The Google sign-in token is invalid or expired.") from exc
    except GoogleAuthError as exc:
        logger.warning("Google token verification service failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in verification is temporarily unavailable.") from exc

    email = claims.get("email")
    if not email or claims.get("email_verified") is not True or not claims.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="A verified Google email is required.")
    try:
        user = get_or_create_google_user(str(claims["sub"]), str(email), str(claims.get("name") or email))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    access_token = create_session(user["id"])
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["full_name"], "role": user["role"]},
    }


@app.get("/api/auth/me")
def me(current_user: dict[str, Any] = Depends(get_current_user_required)):
    return {"user": current_user}


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None), current_user: dict[str, Any] = Depends(get_current_user_required)):
    if authorization and authorization.lower().startswith("bearer "):
        delete_session(authorization[7:].strip())
    return {"status": "logged_out"}


# --- Seller Management Endpoints ---

@app.get("/api/sellers")
def get_sellers(current_user: dict[str, Any] = Depends(get_current_user_required)):
    return {"sellers": list_sellers(current_user["id"])}


@app.post("/api/sellers")
def add_seller(payload: dict[str, Any], current_user: dict[str, Any] = Depends(get_current_user_required)):
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
def get_dashboard_stats(current_user: dict[str, Any] = Depends(get_current_user_required)):
    return get_dashboard_summary(current_user["id"])


# --- Lot Management Endpoints ---

@app.post("/api/v1/lots/save")
def save_lot_transaction_endpoint(payload: LotTransactionCreate, current_user: dict[str, Any] = Depends(get_current_user_required)):
    try:
        record = save_lot_transaction(current_user["id"], payload.dict())
        return {"id": record["id"], "success": True}
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/lots/history")
def lot_history_endpoint(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    farmer_id: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict[str, Any] = Depends(get_current_user_required),
):
    if status_filter and status_filter not in ("BUY", "BUY_WITH_CUT", "REJECT"):
        raise HTTPException(status_code=422, detail="status must be BUY, BUY_WITH_CUT, or REJECT")
    return list_lot_transactions(current_user["id"], limit, offset, farmer_id, status_filter)


@app.get("/api/v1/lots/summary")
def lot_summary_endpoint(current_user: dict[str, Any] = Depends(get_current_user_required)):
    return get_lot_transaction_summary(current_user["id"])

@app.get("/api/lots")
def get_lots(current_user: dict[str, Any] = Depends(get_current_user_required)):
    return {"lots": list_user_lots(current_user["id"])}


@app.post("/api/lots/{lot_id}/decision")
def record_decision(
    lot_id: str,
    payload: dict[str, Any],
    current_user: dict[str, Any] = Depends(get_current_user_required),
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


# --- High-Density Image Processing & Inference Helper ---

def _run_yolo_inference(data: bytes) -> tuple[int, int, list[dict[str, Any]], dict[str, int]]:
    """Decodes image data, downscales high-density frames to safe limits (max 1920px),
    executes the YOLOv8 model (`train2.pt`), and extracts serialized bounding boxes.
    """
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The image analysis service is temporarily unavailable.",
        )

    try:
        # High-Density Memory Optimization:
        # Verify and downscale if image exceeds standard inference dimension (1920px max).
        with Image.open(io.BytesIO(data)) as source:
            source.verify()

        with Image.open(io.BytesIO(data)) as source:
            img = source.convert("RGB")
            orig_w, orig_h = img.size

            max_dim = max(orig_w, orig_h)
            if max_dim > 1920:
                scale = 1920.0 / max_dim
                new_w, new_h = int(orig_w * scale), int(orig_h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
                logger.info("High-density downsampling applied: %dx%d -> %dx%d", orig_w, orig_h, new_w, new_h)

        width, height = img.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="The uploaded file is not a readable image.") from exc

    # Model inference with memory isolation
    try:
        if TORCH_AVAILABLE:
            with torch.inference_mode():
                results = model.predict(source=img, conf=CONFIDENCE, imgsz=640, verbose=False)
        else:
            results = model.predict(source=img, conf=CONFIDENCE, imgsz=640, verbose=False)
    except Exception as exc:
        logger.error("Model inference failure: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Image analysis failed. Please retry shortly.") from exc
    finally:
        try:
            img.close()
            del img
        except Exception:
            pass

    counts = {name: 0 for name in CLASSES}
    detections: list[dict[str, Any]] = []

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
            x1, y1, x2, y2 = [round(float(v), 2) for v in coords]
            counts[class_name] += 1
            detections.append({
                "id": f"det-{len(detections)}",
                "class": class_name,
                "category": map_class_to_category(class_name),
                "confidence": round(confidence, 4),
                "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "normalized_box": {
                    "x1": round(x1 / width, 4) if width > 0 else 0.0,
                    "y1": round(y1 / height, 4) if height > 0 else 0.0,
                    "x2": round(x2 / width, 4) if width > 0 else 0.0,
                    "y2": round(y2 / height, 4) if height > 0 else 0.0,
                },
            })

    class_rank = {name: index for index, name in enumerate(PRIORITY)}
    detections.sort(key=lambda item: (class_rank.get(item["class"], 99), -item["confidence"]))

    return width, height, detections, counts


# --- Core Grain Quality Assessment & Procurement Endpoint (v1) ---

@app.post("/api/v1/analyze-grain")
async def analyze_grain_v1(
    image: UploadFile = File(...),
    variety: Optional[str] = Form("Swarna (MTU 7029)"),
    lot_weight_kg: Optional[float] = Form(None, gt=0, le=500_000),
    seller_id: Optional[int] = Form(None),
    inspector_offer_price: Optional[float] = Form(None),
    manual_baseline_price_per_quintal: Optional[float] = Form(None),
    manual_moisture_pct: Optional[float] = Form(None, ge=5, le=35),
    manual_foreign_matter_pct: Optional[float] = Form(None),
    chalky_deduction_rate_per_pct_per_quintal: Optional[float] = Form(None),
    broken_deduction_rate_per_pct_per_quintal: Optional[float] = Form(None),
    damaged_deduction_rate_per_pct_per_quintal: Optional[float] = Form(None),
    sound_shortfall_rate_per_pct_per_quintal: Optional[float] = Form(None),
    save_lot: bool = Form(True),
    current_user: dict[str, Any] = Depends(get_current_user_required),
):
    """Primary grain inspection endpoint for GRAIN-VISION Mobile & Edge AI.

    Executes:
    1. YOLOv8 model inference across 8 classes (`train2.pt`).
    2. Quality Assessment Engine converting detections into commercial metrics (Sound, Broken, Chalky, Discolored)
       with non-exclusive handling of broken-chalky and pixel area mass approximations.
    3. Optimized Procurement Decision Engine with tiered slab deductions, tolerance allowances,
       and hard-stop contamination rejection rules.
    """
    if not image.content_type or not image.content_type.lower().startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image exceeds upload limit ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    try:
        width, height, detections, counts = _run_yolo_inference(data)
    finally:
        await image.close()
        del data

    valid_grain_count = sum(counts.get(name, 0) for name in GRAIN_SAMPLE_CLASSES)
    if valid_grain_count < MIN_VALID_GRAIN_DETECTIONS:
        return JSONResponse(
            status_code=400,
            content={
                "error": "INVALID_SAMPLE",
                "message": "No valid grains detected in the image. Please capture a proper sample.",
            },
        )

    # 1. Quality Assessment Engine
    quality_metrics = assess_grain_quality(detections, width, height)

    # 2. Reference Price Lookup
    price_reference = get_cached_mandi_reference()
    ref_modal_price = price_reference.get("modal_price_per_quintal") or 2320.0
    if manual_baseline_price_per_quintal is not None:
        if not 0 < manual_baseline_price_per_quintal <= 1_000_000:
            raise HTTPException(status_code=422, detail="Manual baseline price must be greater than zero and at most ₹1,000,000 per quintal.")
        ref_modal_price = manual_baseline_price_per_quintal
        price_reference = {
            **price_reference,
            "modal_price_per_quintal": ref_modal_price,
            "source": "Manual operator override",
            "provider": "manual_override",
            "status": "manual_override",
            "disclaimer": "Manually entered local baseline; informational decision support only.",
        }

    # 3. Run both the existing commercial assessment and the configured
    # screening valuation. Keep the former nested for backwards auditability.
    legacy_decision = evaluate_procurement(
        quality_metrics=quality_metrics,
        base_rate_per_quintal=ref_modal_price,
        lot_weight_kg=lot_weight_kg,
        variety=variety,
        inspector_offer_price=inspector_offer_price,
    )
    try:
        fci_result = evaluate_procurement_lot(
            base_msp_per_quintal=ref_modal_price,
            net_weight_kg=lot_weight_kg or 0.0,
            detection_counts=counts,
            manual_moisture_pct=13.0 if manual_moisture_pct is None else manual_moisture_pct,
            manual_foreign_matter_pct=manual_foreign_matter_pct,
            deduction_rates_per_pct_per_quintal={
                key: value for key, value in {
                    "chalky": chalky_deduction_rate_per_pct_per_quintal,
                    "broken": broken_deduction_rate_per_pct_per_quintal,
                    "damaged_discolored": damaged_deduction_rate_per_pct_per_quintal,
                    "sound_shortfall": sound_shortfall_rate_per_pct_per_quintal,
                }.items() if value is not None
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    fci_valuation = valuation_result_to_dict(fci_result)
    fci_valuation["moisture_input_source"] = "default" if manual_moisture_pct is None else "manual"
    fci_deductions = [
        {
            "name": item["parameter"],
            "tolerance_pct": item["faq_limit"],
            "actual_pct": item["observed_pct"],
            "excess_pct": item["excess_pct"],
            "deduction_percentage": round(
                (item["penalty_rate_per_kg"] / fci_result.base_rate_per_kg) * 100.0, 4
            ) if fci_result.base_rate_per_kg else 0.0,
            "deduction_per_kg_inr": item["penalty_rate_per_kg"],
            "note": "Swarna MTU 7029 project deduction above the configured mill-gate baseline.",
        }
        for item in fci_valuation["deductions"]
    ]
    procurement_decision = {
        **legacy_decision,
        "recommendation": fci_result.recommendation,
        "assessment_status": fci_result.status.value,
        "rejection_reasons": fci_result.rejection_reasons,
        "base_rate_per_quintal": fci_result.base_rate_per_quintal,
        "base_rate_per_kg": fci_result.base_rate_per_kg,
        "total_deduction_percentage": fci_result.total_deduction_pct_of_asking,
        "total_deduction_per_kg_inr": fci_result.total_deduction_per_kg,
        "quality_premium_percentage": 0.0,
        "quality_premium_per_kg_inr": 0.0,
        "estimated_rate_per_kg": fci_result.effective_rate_per_kg,
        "estimated_rate_per_quintal": round(fci_result.effective_rate_per_kg * 100.0, 2),
        "target_negotiation_rate_per_kg": fci_result.target_offer_rate_per_kg,
        "lot_weight_kg": fci_result.gross_lot_weight_kg,
        "net_payable_weight_kg": fci_result.total_lot_weight_kg,
        "drying_cost_total": fci_result.moisture_drying_cost_total,
        "moisture_warnings": fci_result.warnings,
        "lot_weight_quintals": round(fci_result.total_lot_weight_kg / 100.0, 3),
        "total_estimated_lot_price": fci_result.estimated_total_payout,
        "deductions": fci_deductions,
        "explanation_logs": [
            *fci_result.rejection_reasons,
            *[
                f"{item['parameter']}: {item['observed_pct']:.2f}% vs Swarna baseline {item['faq_limit']:.2f}%; "
                f"cut INR {item['penalty_rate_per_kg']:.4f}/kg."
                for item in fci_valuation["deductions"]
            ],
        ],
        "compliance_disclosure": FCI_SCREENING_DISCLOSURE,
        "legacy_assessment": legacy_decision,
    }

    # 4. Resolve Seller Details if provided
    seller_name = None
    if seller_id and seller_id > 0:
        seller_obj = get_seller_by_id(seller_id, current_user["id"])
        if seller_obj:
            seller_name = seller_obj["name"]

    # 5. Persist Lot Record if requested
    saved_lot = None
    if save_lot and quality_metrics["total_grains"] > 0:
        saved_lot = create_lot_record(
            user_id=current_user["id"],
            seller_id=seller_id if seller_id and seller_id > 0 else None,
            seller_name=seller_name,
            image_filename=image.filename,
            total_grains=quality_metrics["total_grains"],
            quality_score=quality_metrics["quality_score"],
            metrics=quality_metrics,
            weight_kg=lot_weight_kg or 0.0,
            base_price_per_quintal=ref_modal_price,
            estimated_rate_per_kg=fci_result.effective_rate_per_kg,
            total_estimated_price=fci_result.estimated_total_payout,
        )

    return {
        "status": "success",
        "image": {
            "filename": image.filename,
            "width": width,
            "height": height,
        },
        "model": {
            "name": "YOLOv8n-grain-vision-train2",
            "classes": CLASSES,
            "confidence_threshold": CONFIDENCE,
        },
        "detections": detections,
        "metrics": quality_metrics,
        "decision": procurement_decision,
        "fci_valuation": fci_valuation,
        "price_reference": price_reference,
        "lot": saved_lot,
        "disclaimer": quality_metrics.get("disclaimer", COMPLIANCE_DISCLOSURE),
    }


# --- Legacy / Compatible Image Analysis Endpoint ---

@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(...),
    lot_weight_kg: Optional[float] = Form(None, gt=0, le=500_000),
    seller_id: Optional[int] = Form(None),
    save_lot: bool = Form(True),
    current_user: dict[str, Any] = Depends(get_current_user_required),
):
    """Analyzes a rice sample image for defects with high-density grain memory optimization.
    Uses cached reference prices immediately and returns both legacy and quality_engine metrics.
    """
    if not image.content_type or not image.content_type.lower().startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    data = await image.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail=f"Image exceeds upload limit ({MAX_IMAGE_BYTES // (1024 * 1024)} MB).")

    try:
        width, height, detections, counts = _run_yolo_inference(data)
    finally:
        await image.close()
        del data

    # Non-blocking cached mandi reference
    price_reference = get_cached_mandi_reference()
    ref_modal_price = price_reference.get("modal_price_per_quintal") or 2320.0

    # Calculate legacy metrics
    metrics = calculate_metrics(
        counts=counts,
        classes=CLASSES,
        priority=PRIORITY,
        reference_price_per_quintal=ref_modal_price,
        lot_weight_kg=lot_weight_kg,
    )

    # Calculate commercial quality engine metrics
    quality_assessment = assess_grain_quality(detections, width, height)
    procurement_decision = evaluate_procurement(
        quality_metrics=quality_assessment,
        base_rate_per_quintal=ref_modal_price,
        lot_weight_kg=lot_weight_kg,
    )

    seller_name = None
    if seller_id and seller_id > 0:
        seller_obj = get_seller_by_id(seller_id, current_user["id"])
        if seller_obj:
            seller_name = seller_obj["name"]

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
        "quality_assessment": quality_assessment,
        "decision": procurement_decision,
        "quality": {
            "score": metrics["quality_score"],
            "grade": quality_assessment["grade"],
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
            "compliance": COMPLIANCE_DISCLOSURE,
        },
    }

