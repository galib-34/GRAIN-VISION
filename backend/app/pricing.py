"""Official mandi reference provider with background caching, error diagnostics, and transparent disclaimers.

Key architectural guardrails:
1. NEVER requests live external network prices during individual image analysis operations.
2. Background asynchronous cache scheduler refreshes reference prices periodically (e.g. twice daily).
3. Detailed internal diagnostic logging with full stack traces on network or HTTP 403 errors (never masked as 'unconfigured').
4. Graceful fallback hierarchy:
   Live/Fresh Cache -> Last Known Valid Cache -> User Configured Manual Reference -> Configured Default Baseline -> Explicit Error/Unconfigured State.
"""
from __future__ import annotations

import asyncio
import logging
import math
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from types import MappingProxyType
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("grain_vision.pricing")

OGD_BASE = "https://api.data.gov.in/resource"
OGD_CATALOG = "https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi"

DEFAULT_MANDI_CACHE_TTL_HOURS = 12
AP_PADDY_COMMON_MSP_2026_27 = 2441.0
AP_PADDY_COMMON_MSP_SOURCE = "Default MSP Baseline (₹2,441/qtl)"

# In-memory cached state with thread/async safe lock
_CACHE_LOCK = asyncio.Lock()
_MANDI_CACHE: dict[str, Any] = {
    "data": None,
    "last_fetched_at": None,
    "last_attempt_at": None,
    "last_status": "uninitialized",
    "last_error": None,
}

INFORMATIONAL_DISCLAIMER = (
    "Informational baseline only. This mandi reference price is an informational market indicator "
    "and does NOT constitute a formal, binding purchase offer for any specific rice lot quality."
)


def _manual_reference() -> dict[str, Any] | None:
    raw_price = os.getenv("AP_MANUAL_REFERENCE_PRICE_PER_QUINTAL", "").strip()
    date = os.getenv("AP_MANUAL_REFERENCE_DATE", "").strip()
    source = os.getenv("AP_MANUAL_REFERENCE_SOURCE", "").strip()
    if not raw_price or not date or not source:
        return None
    if urlparse(source).scheme not in {"http", "https"} or not urlparse(source).netloc:
        return None
    try:
        value = float(raw_price)
        datetime.strptime(date, "%Y-%m-%d")
        if value <= 0:
            return None
    except ValueError:
        return None
    return {
        "commodity": "Paddy (manual reference)",
        "market": "User-configured Local Reference",
        "district": "Manual",
        "variety": "Common",
        "date": date,
        "modal_price_per_quintal": value,
        "source": source,
        "source_url": source,
        "provider": "manual_reference",
        "status": "manual_fallback",
        "is_cached": False,
        "disclaimer": INFORMATIONAL_DISCLAIMER,
        "note": "Manually configured reference price; informational baseline only.",
    }


def _default_base_reference() -> dict[str, Any]:
    """Official 2026-27 Common Paddy MSP fallback, expressed per quintal."""
    return {
        "commodity": "Paddy (Common)",
        "market": "Andhra Pradesh · MSP reference",
        "district": "State-level baseline",
        "variety": "Common paddy benchmark · Swarna MTU 7029 intake",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "modal_price_per_quintal": AP_PADDY_COMMON_MSP_2026_27,
        "source": AP_PADDY_COMMON_MSP_SOURCE,
        "source_url": "https://dfpd.gov.in/msp-for-wheat-and-rice/en",
        "provider": "official_msp_baseline",
        "status": "default_baseline",
        "is_cached": False,
        "disclaimer": INFORMATIONAL_DISCLAIMER,
        "note": "KMS 2026-27 Government of India MSP for Paddy (Common). This is a baseline, not a live AP mandi quotation.",
    }


async def fetch_live_mandi_price() -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """Internal fetcher for data.gov.in mandi dataset.

    Returns (price_dict, error_message).
    Logs detailed diagnostic error stack traces on HTTP 403 or network errors.
    """
    resource_id = os.getenv("OGD_MANDI_RESOURCE_ID", "").strip()
    api_key = os.getenv("OGD_API_KEY", "").strip()

    if not resource_id or not api_key:
        logger.info("data.gov.in credentials or resource_id missing in environment.")
        return None, "OGD_API_KEY or OGD_MANDI_RESOURCE_ID not configured."

    url = f"{OGD_BASE}/{resource_id}"
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": 1000,
        "filters[state.keyword]": "Andhra Pradesh",
    }
    params["filters[commodity]"] = "Paddy (Common)"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 403:
                error_msg = f"HTTP 403 Forbidden received from data.gov.in API. Check API key validity or quotas. Response body: {response.text[:300]}"
                logger.error(
                    "DIAGNOSTIC ERROR [data.gov.in Mandi API]: %s\nEndpoint: %s\nParams: %s",
                    error_msg, url, {k: (v if k != 'api-key' else '***REDACTED***') for k, v in params.items()},
                    exc_info=True
                )
                return None, error_msg

            response.raise_for_status()
            payload = response.json()

        records = payload.get("records", []) if isinstance(payload, dict) else []
        valid = []
        for record in records:
            try:
                state = str(record.get("state", "")).strip().lower()
                commodity = " ".join(str(record.get("commodity", "")).strip().casefold().split())
                date = str(record.get("arrival_date", record.get("date", ""))).strip()
                price = float(str(record.get("modal_price", "")).replace(",", ""))
                parsed_date = None
                for date_format in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                    try:
                        parsed_date = datetime.strptime(date, date_format)
                        break
                    except ValueError:
                        continue
                if parsed_date is None:
                    continue
                if state == "andhra pradesh" and commodity == "paddy (common)" and price > 0:
                    valid.append((parsed_date, price, record))
            except (ValueError, TypeError):
                continue

        if valid:
            valid.sort(key=lambda item: item[0], reverse=True)
            parsed_date, price, record = valid[0]
            result = {
                "commodity": "Paddy (Common)",
                "market": record.get("market"),
                "district": record.get("district"),
                "variety": record.get("variety"),
                "date": parsed_date.date().isoformat(),
                "modal_price_per_quintal": price,
                "min_price_per_quintal": record.get("min_price"),
                "max_price_per_quintal": record.get("max_price"),
                "source": "Live Agmarknet AP Mandi",
                "source_url": OGD_CATALOG,
                "provider": "data.gov.in",
                "status": "live",
                "is_cached": False,
                "disclaimer": INFORMATIONAL_DISCLAIMER,
                "note": "Daily mandi paddy modal-price reference; informational baseline only.",
            }
            return result, None

        logger.warning("data.gov.in returned 0 matching valid Andhra Pradesh paddy records.")
        return None, "No matching Andhra Pradesh paddy records found in upstream response."

    except httpx.HTTPError as exc:
        error_msg = f"Network or HTTP error communicating with data.gov.in: {exc}"
        logger.error("DIAGNOSTIC ERROR [data.gov.in Mandi API]: %s", error_msg, exc_info=True)
        return None, error_msg
    except Exception as exc:
        error_msg = f"Unexpected failure parsing data.gov.in response: {exc}"
        logger.error("DIAGNOSTIC ERROR [data.gov.in Mandi API]: %s", error_msg, exc_info=True)
        return None, error_msg


async def refresh_mandi_cache(force: bool = False) -> dict[str, Any]:
    """Background or on-demand cache refresher.

    Updates the internal cache asynchronously. Does not raise exceptions to callers.
    """
    async with _CACHE_LOCK:
        now = datetime.utcnow()
        last_fetched = _MANDI_CACHE["last_fetched_at"]
        ttl = timedelta(hours=int(os.getenv("MANDI_CACHE_TTL_HOURS", str(DEFAULT_MANDI_CACHE_TTL_HOURS))))

        # Check if current cache is still fresh and not forced
        if not force and last_fetched and (now - last_fetched) < ttl and _MANDI_CACHE["data"] is not None:
            return _MANDI_CACHE["data"]

        _MANDI_CACHE["last_attempt_at"] = now.isoformat()

        # Check credentials first
        resource_id = os.getenv("OGD_MANDI_RESOURCE_ID", "").strip()
        api_key = os.getenv("OGD_API_KEY", "").strip()
        if not resource_id or not api_key:
            _MANDI_CACHE["last_status"] = "unconfigured"
            _MANDI_CACHE["last_error"] = "OGD_API_KEY or OGD_MANDI_RESOURCE_ID is not configured in .env."
            fallback = _default_base_reference()
            fallback["warning"] = "Live Agmarknet AP Mandi is not configured. Using the 2026-27 Common Paddy MSP baseline."
            _MANDI_CACHE.update(data=fallback, last_fetched_at=now, last_status="default_baseline", last_error=_MANDI_CACHE["last_error"])
            return dict(fallback)

        logger.info("Refreshing mandi reference price cache from data.gov.in...")
        data, err = await fetch_live_mandi_price()

        if data:
            data_copy = dict(data)
            data_copy["is_cached"] = True
            data_copy["cached_at"] = now.isoformat()
            _MANDI_CACHE["data"] = data_copy
            _MANDI_CACHE["last_fetched_at"] = now
            _MANDI_CACHE["last_status"] = "live_cached"
            _MANDI_CACHE["last_error"] = None
            logger.info("Mandi reference price cache successfully updated: ₹%s / quintal", data["modal_price_per_quintal"])
            return data_copy
        else:
            _MANDI_CACHE["last_status"] = "upstream_error"
            _MANDI_CACHE["last_error"] = err

            baseline = _default_base_reference()
            baseline["warning"] = f"Live Agmarknet AP Mandi refresh failed ({err}). Using the 2026-27 Common Paddy MSP baseline."
            _MANDI_CACHE.update(data=baseline, last_fetched_at=now, last_status="default_baseline", last_error=err)
            return dict(baseline)

            # 4. Explicit error payload (NEVER disguised as 'unconfigured' when credentials exist!)
            return {
                "available": False,
                "provider": "data.gov.in",
                "status": "upstream_error",
                "error_detail": err,
                "disclaimer": INFORMATIONAL_DISCLAIMER,
                "note": f"Mandi price service temporarily unavailable: {err}. See server diagnostic logs for full stack trace.",
            }


def get_cached_mandi_reference() -> dict[str, Any]:
    """NON-BLOCKING instant lookup used during image analysis and fast read APIs.

    NEVER initiates a live external network request during an image analysis transaction.
    """
    if _MANDI_CACHE["data"] is not None:
        cached = dict(_MANDI_CACHE["data"])
        cached["is_cached"] = True
        return cached

    baseline = _default_base_reference()
    if _MANDI_CACHE["last_error"]:
        baseline["warning"] = f"Live Agmarknet AP Mandi unavailable ({_MANDI_CACHE['last_error']}). Using the 2026-27 Common Paddy MSP baseline."
    return baseline


async def background_mandi_scheduler(interval_hours: int = 12) -> None:
    """Async background task that runs for the lifetime of the application."""
    logger.info("Starting background Mandi price cache scheduler (interval: %d hours)...", interval_hours)
    while True:
        try:
            await refresh_mandi_cache(force=True)
        except Exception as exc:
            logger.error("Background mandi scheduler unexpected error: %s", exc, exc_info=True)
        await asyncio.sleep(interval_hours * 3600)


# Project-supplied screening values; verify the applicable KMS circular before
# using these limits or cut rates for statutory procurement.
class AssessmentStatus(str, Enum):
    ACCEPTED = "BUY"
    ACCEPTED_WITH_DEDUCTIONS = "BUY_WITH_CUT"
    REJECTED = "REJECT"


@dataclass(frozen=True)
class QualityParameterSpec:
    name: str
    faq_limit: float
    max_limit: float
    penalty_factor: float

    def __post_init__(self) -> None:
        values = (self.faq_limit, self.max_limit, self.penalty_factor)
        if not all(math.isfinite(value) for value in values):
            raise ValueError(f"Quality limits for {self.name} must be finite.")
        if self.faq_limit < 0 or self.max_limit < self.faq_limit or self.penalty_factor < 0:
            raise ValueError(f"Quality limits for {self.name} are invalid.")


# Definitive project baseline for Swarna MTU 7029 at the mill gate. These are
# immutable software assumptions, not an FCI statutory grade or laboratory
# specification; field operators may adjust penalty rates, never these baselines.
SWARNA_MILL_GATE_BASELINES: Mapping[str, float] = MappingProxyType({
    "chalky_pct": 12.0,
    "broken_pct": 15.0,
    "damaged_discolored_pct": 3.0,
    "sound_grain_pct": 58.0,
    "sound_penalty_floor_pct": 50.0,
    "moisture_pct": 14.0,
    "moisture_hard_reject_pct": 20.0,
    "foreign_matter_pct": 1.0,
    "grade_a_sound_pct": 65.0,
    "grade_a_max_defects_pct": 20.0,
    "grade_b_max_defects_pct": 32.0,
    "grade_c_max_defects_pct": 45.0,
})
SWARNA_DEDUCTION_RATES_PER_PCT_PER_QUINTAL: Mapping[str, float] = MappingProxyType({
    "chalky": 12.0,
    "broken": 15.0,
    "damaged_discolored": 20.0,
    "sound_shortfall": 10.0,
})
# Retain aliases for existing internal callers.
FRESH_MILLED_SCREENING_RULES: Mapping[str, QualityParameterSpec] = MappingProxyType({
    "moisture": QualityParameterSpec("Moisture Content", 14.0, 20.0, 1.0),
    "foreign_matter": QualityParameterSpec("Foreign Matter", 1.0, 1.0, 1.0),
    "damaged_discolored": QualityParameterSpec("Damaged/Discolored", 3.0, 100.0, 0.0),
    "chalky": QualityParameterSpec("Chalky Grains", 12.0, 100.0, 0.0),
    "broken": QualityParameterSpec("Broken Grains", 15.0, 100.0, 0.0),
})
FCI_PADDY_RULES = FRESH_MILLED_SCREENING_RULES
MILLING_RECOVERY_LOSS_FACTOR_PER_PCT = MappingProxyType({"broken": 0.0, "chalky": 0.0})
DRYING_COST_PER_KG_EXCESS_WATER = 2.0

GRAIN_MASS_WEIGHTS = {
    "sound": 1.00,
    "chalky": 0.92,
    "damaged_discolored": 0.88,
    "broken": 0.45,
    "foreign_matter": 1.10,
}

FCI_SCREENING_DISCLOSURE = (
    "Swarna MTU 7029 mill-gate project estimate. Immutable defect baselines bridge "
    "computer-vision proportions and physical milling recovery; operator-configured "
    "rates are negotiable assumptions. Foreign matter is deducted from payable weight, "
    "and moisture above 14% is removed to a 14% dry-equivalent weight basis with a "
    "₹2/kg excess-water drying charge; readings above 17% are high-risk and above 20% reject. This is "
    "not an official laboratory result, FCI grade, or statutory procurement rule. "
    "Calibrate the model against measured mill yields and the applicable procurement terms."
)

_DETECTION_CLASS_GROUPS = {
    "sound": "sound",
    "whole-chalky": "chalky",
    "chalky": "chalky",
    "broken-clear": "broken",
    "broken": "broken",
    "broken-chalky": "broken_chalky",
    "unsound": "damaged_discolored",
    "damaged_discolored": "damaged_discolored",
    "foreign-object": "foreign_matter",
    "foreign_object": "foreign_matter",
    "plastic": "foreign_matter",
    "stone": "foreign_matter",
    "foreign_matter": "foreign_matter",
}
_DETECTION_MASS_FACTORS = {
    "sound": GRAIN_MASS_WEIGHTS["sound"],
    "chalky": GRAIN_MASS_WEIGHTS["chalky"],
    "broken": GRAIN_MASS_WEIGHTS["broken"],
    "broken_chalky": GRAIN_MASS_WEIGHTS["broken"],
    "damaged_discolored": GRAIN_MASS_WEIGHTS["damaged_discolored"],
    "foreign_matter": GRAIN_MASS_WEIGHTS["foreign_matter"],
}


def _validate_percentage(name: str, value: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number from 0 to 100.") from exc
    if not math.isfinite(number) or not 0.0 <= number <= 100.0:
        raise ValueError(f"{name} must be a finite percentage from 0 to 100.")
    return number


def convert_counts_to_mass_percentages(
    counts: Dict[str, int],
    manual_moisture_pct: float = 13.0,
    manual_foreign_matter_pct: Optional[float] = None,
) -> Dict[str, float]:
    """Convert YOLO labels to indicative mass percentages.

    broken-chalky contributes to both defect measures but is counted once in
    the visual-mass denominator. The mass factors are project heuristics.
    """
    if not isinstance(counts, dict):
        raise ValueError("Detection counts must be a mapping of class names to integers.")
    moisture = _validate_percentage("manual_moisture_pct", manual_moisture_pct)
    manual_foreign = (
        _validate_percentage("manual_foreign_matter_pct", manual_foreign_matter_pct)
        if manual_foreign_matter_pct is not None
        else None
    )

    grouped_counts = {group: 0 for group in _DETECTION_MASS_FACTORS}
    total_count = 0
    for raw_name, raw_count in counts.items():
        if isinstance(raw_count, bool) or not isinstance(raw_count, int) or raw_count < 0:
            raise ValueError(f"Detection count for {raw_name!r} must be a non-negative integer.")
        total_count += raw_count
        group = _DETECTION_CLASS_GROUPS.get(str(raw_name).strip().lower())
        if raw_count and group is None:
            raise ValueError(f"Unsupported detection class for mass conversion: {raw_name!r}.")
        if group:
            grouped_counts[group] += raw_count

    class_mass = {
        group: count * _DETECTION_MASS_FACTORS[group]
        for group, count in grouped_counts.items()
    }
    total_visual_mass = sum(class_mass.values())
    if total_visual_mass > 0:
        sound_pct = class_mass["sound"] / total_visual_mass * 100.0
        chalky_pct = (class_mass["chalky"] + class_mass["broken_chalky"]) / total_visual_mass * 100.0
        broken_pct = (class_mass["broken"] + class_mass["broken_chalky"]) / total_visual_mass * 100.0
        damaged_pct = class_mass["damaged_discolored"] / total_visual_mass * 100.0
        detected_foreign_pct = class_mass["foreign_matter"] / total_visual_mass * 100.0
    else:
        sound_pct = chalky_pct = broken_pct = damaged_pct = detected_foreign_pct = 0.0

    return {
        "sound": sound_pct,
        "chalky": chalky_pct,
        "broken": broken_pct,
        "damaged_discolored": damaged_pct,
        "foreign_matter": manual_foreign if manual_foreign is not None else detected_foreign_pct,
        "moisture": moisture,
        "total_detected_count": float(total_count),
    }


@dataclass
class DeductionItem:
    parameter: str
    observed_pct: float
    faq_limit: float
    excess_pct: float
    penalty_rate_per_kg: float
    total_deduction_val: float


@dataclass
class ValuationResult:
    status: AssessmentStatus
    grade: str
    base_rate_per_quintal: float
    base_rate_per_kg: float
    effective_rate_per_kg: float
    total_lot_weight_kg: float
    estimated_total_payout: float
    total_deduction_per_kg: float
    target_offer_rate_per_kg: float = 0.0
    minimum_floor_rate_per_kg: float = 0.0
    fair_market_payout_min: float = 0.0
    fair_market_payout_max: float = 0.0
    estimated_recovery_loss_per_kg: float = 0.0
    gross_lot_weight_kg: float = 0.0
    foreign_matter_weight_deduction_kg: float = 0.0
    moisture_drying_weight_deduction_kg: float = 0.0
    moisture_drying_cost_total: float = 0.0
    moisture_excess_pct: float = 0.0
    warnings: List[str] = field(default_factory=list)
    moisture_input_source: str = "default"
    total_defects_pct: float = 0.0
    total_deduction_per_quintal: float = 0.0
    total_deduction_pct_of_asking: float = 0.0
    recommendation: str = "BUY"
    negotiation_band_min_per_quintal: float = 0.0
    negotiation_band_max_per_quintal: float = 0.0
    deduction_rates_per_pct_per_quintal: Dict[str, float] = field(default_factory=dict)
    rejection_reasons: List[str] = field(default_factory=list)
    deductions: List[DeductionItem] = field(default_factory=list)
    mass_percentages: Dict[str, float] = field(default_factory=dict)
    disclosure: str = FCI_SCREENING_DISCLOSURE


def evaluate_procurement_lot(
    base_msp_per_quintal: float,
    net_weight_kg: float,
    detection_counts: Dict[str, int],
    manual_moisture_pct: float = 13.0,
    manual_foreign_matter_pct: Optional[float] = None,
    rules: Optional[Mapping[str, QualityParameterSpec]] = None,
    deduction_rates_per_pct_per_quintal: Optional[Mapping[str, float]] = None,
) -> ValuationResult:
    """Calculate a Swarna MTU 7029 mill-gate estimate from CV proportions.

    Rates are INR per quintal for each one percentage point above/below the
    immutable agronomic baselines. The returned status remains compatible with
    the existing API; ``recommendation`` preserves BUY/NEGOTIATE/HARD/REJECT.
    """
    try:
        base_rate_per_quintal = float(base_msp_per_quintal)
        lot_weight = float(net_weight_kg)
    except (TypeError, ValueError) as exc:
        raise ValueError("Baseline rate and lot weight must be numeric.") from exc
    if not math.isfinite(base_rate_per_quintal) or base_rate_per_quintal <= 0:
        raise ValueError("Baseline rate per quintal must be finite and greater than zero.")
    if not math.isfinite(lot_weight) or lot_weight < 0:
        raise ValueError("Net lot weight must be finite and non-negative.")
    rules = rules if rules is not None else FCI_PADDY_RULES
    if not rules:
        raise ValueError("At least one quality rule is required.")
    rates = dict(SWARNA_DEDUCTION_RATES_PER_PCT_PER_QUINTAL)
    if deduction_rates_per_pct_per_quintal:
        for key, value in deduction_rates_per_pct_per_quintal.items():
            if key not in rates:
                raise ValueError(f"Unsupported deduction rate setting: {key}.")
            try:
                rate = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Deduction rate {key} must be numeric.") from exc
            if not math.isfinite(rate) or rate < 0:
                raise ValueError(f"Deduction rate {key} must be finite and non-negative.")
            rates[key] = rate

    mass = convert_counts_to_mass_percentages(
        detection_counts,
        manual_moisture_pct=manual_moisture_pct,
        manual_foreign_matter_pct=manual_foreign_matter_pct,
    )
    base_rate_per_kg = base_rate_per_quintal / 100.0
    baselines = SWARNA_MILL_GATE_BASELINES
    sound_pct = mass["sound"]
    total_defects = mass["broken"] + mass["chalky"] + mass["damaged_discolored"]
    foreign_pct = mass["foreign_matter"]
    moisture_pct = mass["moisture"]
    rejection_reasons: List[str] = []
    deductions: List[DeductionItem] = []
    total_deduction_per_quintal = 0.0
    # Remove foreign matter first, then calculate excess water and its drying
    # charge on the dirt-adjusted weight using the 14% moisture baseline.
    foreign_weight = lot_weight * max(0.0, 1.0 - foreign_pct / 100.0)
    moisture_excess_pct = max(0.0, moisture_pct - baselines["moisture_pct"])
    moisture_weight_deduction = foreign_weight * (moisture_excess_pct / (100.0 - baselines["moisture_pct"]))
    payable_weight = foreign_weight - moisture_weight_deduction
    drying_cost_total = moisture_weight_deduction * DRYING_COST_PER_KG_EXCESS_WATER
    foreign_weight_deduction = lot_weight - foreign_weight
    warnings: List[str] = []
    if mass["total_detected_count"] == 0:
        rejection_reasons.append("No grain or foreign-matter detections were available for valuation.")
    moisture_limit = rules.get("moisture", FRESH_MILLED_SCREENING_RULES["moisture"]).max_limit
    foreign_limit = rules.get("foreign_matter", FRESH_MILLED_SCREENING_RULES["foreign_matter"]).max_limit
    if moisture_pct > moisture_limit:
        rejection_reasons.append(f"Moisture ({moisture_pct:.2f}%) exceeds the safe screening limit of {moisture_limit:.2f}%.")
    elif moisture_pct > 17.0:
        warnings.append("High moisture (above 17%) increases storage risk; negotiate and dry promptly.")
    if foreign_pct > foreign_limit:
        rejection_reasons.append(f"Foreign matter ({foreign_pct:.2f}%) exceeds the safe screening limit of {foreign_limit:.2f}%.")

    # Explicit agronomic value cuts, in INR/quintal per percentage point.
    parameter_inputs = (
        ("chalky", "Chalky Grains", mass["chalky"], baselines["chalky_pct"], rates["chalky"]),
        ("broken", "Broken Grains", mass["broken"], baselines["broken_pct"], rates["broken"]),
        ("damaged_discolored", "Discoloured / Damaged", mass["damaged_discolored"], baselines["damaged_discolored_pct"], rates["damaged_discolored"]),
    )
    for _, title, observed, baseline, rate_per_pct_qtl in parameter_inputs:
        excess = max(0.0, observed - baseline)
        if excess:
            cut_per_quintal = excess * rate_per_pct_qtl
            total_deduction_per_quintal += cut_per_quintal
            deductions.append(DeductionItem(
                parameter=title, observed_pct=round(observed, 2), faq_limit=baseline,
                excess_pct=round(excess, 2),
                penalty_rate_per_kg=round(cut_per_quintal / 100.0, 4),
                total_deduction_val=round(cut_per_quintal * payable_weight / 100.0, 2),
            ))

    sound_shortfall = min(
        max(0.0, baselines["sound_grain_pct"] - sound_pct),
        baselines["sound_grain_pct"] - baselines["sound_penalty_floor_pct"],
    )
    if sound_shortfall:
        cut_per_quintal = sound_shortfall * rates["sound_shortfall"]
        total_deduction_per_quintal += cut_per_quintal
        deductions.append(DeductionItem(
            parameter="Sound Grain Shortfall", observed_pct=round(sound_pct, 2),
            faq_limit=baselines["sound_grain_pct"], excess_pct=round(sound_shortfall, 2),
            penalty_rate_per_kg=round(cut_per_quintal / 100.0, 4),
            total_deduction_val=round(cut_per_quintal * payable_weight / 100.0, 2),
        ))

    rounded_mass = {key: round(value, 2) for key, value in mass.items()}

    if sound_pct < baselines["sound_penalty_floor_pct"]:
        rejection_reasons.append(f"Sound grain ({sound_pct:.2f}%) is below the Grade D minimum of {baselines['sound_penalty_floor_pct']:.2f}%.")
    if total_defects > baselines["grade_c_max_defects_pct"]:
        rejection_reasons.append(f"Total defects ({total_defects:.2f}%) exceed the Grade D limit of {baselines['grade_c_max_defects_pct']:.2f}%.")

    if sound_pct < baselines["sound_penalty_floor_pct"] or total_defects > baselines["grade_c_max_defects_pct"]:
        grade = "Grade D (Poor)"
        grade_severity = 3
    elif sound_pct >= baselines["grade_a_sound_pct"] and total_defects <= baselines["grade_a_max_defects_pct"]:
        grade = "Grade A (Premium)"
        grade_severity = 0
    elif sound_pct >= baselines["sound_grain_pct"] and total_defects <= baselines["grade_b_max_defects_pct"]:
        grade = "Grade B (Standard)"
        grade_severity = 1
    else:
        grade = "Grade C (Below Standard)"
        grade_severity = 2

    fair_price_per_quintal = max(0.0, base_rate_per_quintal - total_deduction_per_quintal)
    asking_value = base_rate_per_quintal * lot_weight / 100.0
    payout = fair_price_per_quintal * payable_weight / 100.0
    payout = max(0.0, payout - drying_cost_total)
    deduction_pct = ((asking_value - payout) / asking_value * 100.0) if asking_value else 0.0
    if deduction_pct > 25.0 and "Total deductions exceed the 25% rejection threshold." not in rejection_reasons:
        rejection_reasons.append("Total deductions exceed the 25% rejection threshold.")
    deduction_severity = 3 if deduction_pct > 25.0 else 2 if deduction_pct >= 15.0 else 1 if deduction_pct >= 5.0 else 0
    severity = max(grade_severity, deduction_severity)
    if moisture_pct > 17.0:
        severity = max(severity, 1)
    if rejection_reasons:
        severity = 3
    recommendation = ("BUY", "NEGOTIATE", "NEGOTIATE HARD", "REJECT")[severity]
    assessment_status = (
        AssessmentStatus.REJECTED if severity == 3
        else AssessmentStatus.ACCEPTED if severity == 0
        else AssessmentStatus.ACCEPTED_WITH_DEDUCTIONS
    )
    if severity == 3:
        payout = 0.0
        fair_price_per_quintal = 0.0
    band_min = max(0.0, fair_price_per_quintal - 30.0)
    band_max = fair_price_per_quintal + 30.0

    if rejection_reasons:
        return ValuationResult(
            status=AssessmentStatus.REJECTED,
            grade=grade,
            base_rate_per_quintal=round(base_rate_per_quintal, 2),
            base_rate_per_kg=round(base_rate_per_kg, 2),
            effective_rate_per_kg=0.0,
            total_lot_weight_kg=round(payable_weight, 3),
            estimated_total_payout=payout,
            total_deduction_per_kg=round(total_deduction_per_quintal / 100.0, 4),
            target_offer_rate_per_kg=0.0,
            minimum_floor_rate_per_kg=0.0,
            fair_market_payout_min=0.0,
            fair_market_payout_max=0.0,
            gross_lot_weight_kg=round(lot_weight, 3),
            foreign_matter_weight_deduction_kg=round(foreign_weight_deduction, 3),
            moisture_drying_weight_deduction_kg=round(moisture_weight_deduction, 3),
            moisture_drying_cost_total=round(drying_cost_total, 2),
            moisture_excess_pct=round(moisture_excess_pct, 2),
            warnings=warnings,
            total_defects_pct=round(total_defects, 2),
            total_deduction_per_quintal=round(total_deduction_per_quintal, 2),
            total_deduction_pct_of_asking=round(deduction_pct, 2),
            recommendation=recommendation,
            negotiation_band_min_per_quintal=round(band_min, 2),
            negotiation_band_max_per_quintal=round(band_max, 2),
            deduction_rates_per_pct_per_quintal=rates,
            rejection_reasons=rejection_reasons,
            deductions=deductions,
            mass_percentages=rounded_mass,
        )
    effective_rate_per_kg = payout / payable_weight if payable_weight > 0 else 0.0
    band_payout_min = max(0.0, band_min * payable_weight / 100.0 - drying_cost_total)
    band_payout_max = max(0.0, band_max * payable_weight / 100.0 - drying_cost_total)
    return ValuationResult(
        status=assessment_status,
        grade=grade,
        base_rate_per_quintal=round(base_rate_per_quintal, 2),
        base_rate_per_kg=round(base_rate_per_kg, 2),
        effective_rate_per_kg=round(effective_rate_per_kg, 2),
        total_lot_weight_kg=round(payable_weight, 3),
        estimated_total_payout=round(payout, 2),
        total_deduction_per_kg=round(total_deduction_per_quintal / 100.0, 4),
        target_offer_rate_per_kg=round(effective_rate_per_kg, 2),
        minimum_floor_rate_per_kg=round(band_payout_min / payable_weight, 2) if payable_weight > 0 else 0.0,
        fair_market_payout_min=round(band_payout_min, 2),
        fair_market_payout_max=round(band_payout_max, 2),
        estimated_recovery_loss_per_kg=0.0,
        gross_lot_weight_kg=round(lot_weight, 3),
        foreign_matter_weight_deduction_kg=round(foreign_weight_deduction, 3),
        moisture_drying_weight_deduction_kg=round(moisture_weight_deduction, 3),
        moisture_drying_cost_total=round(drying_cost_total, 2),
        moisture_excess_pct=round(moisture_excess_pct, 2),
        warnings=warnings,
        total_defects_pct=round(total_defects, 2),
        total_deduction_per_quintal=round(total_deduction_per_quintal, 2),
        total_deduction_pct_of_asking=round(deduction_pct, 2),
        recommendation=recommendation,
        negotiation_band_min_per_quintal=round(band_min, 2),
        negotiation_band_max_per_quintal=round(band_max, 2),
        deduction_rates_per_pct_per_quintal=rates,
        deductions=deductions,
        mass_percentages=rounded_mass,
    )


def valuation_result_to_dict(result: ValuationResult) -> Dict[str, Any]:
    """JSON-friendly serialization for FastAPI response payloads."""
    payload = asdict(result)
    payload["status"] = result.status.value
    return payload
