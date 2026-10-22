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
import os
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("grain_vision.pricing")

OGD_BASE = "https://api.data.gov.in/resource"
OGD_CATALOG = "https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi"

DEFAULT_MANDI_CACHE_TTL_HOURS = 12

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


def _default_base_reference() -> dict[str, Any] | None:
    """Configurable fallback baseline price when no live quote or manual date quote is available."""
    raw_price = os.getenv("BASE_REFERENCE_PRICE_PER_QUINTAL", "2300").strip()
    try:
        value = float(raw_price)
        if value <= 0:
            return None
    except ValueError:
        return None

    return {
        "commodity": "Paddy (baseline fallback)",
        "market": "Standard Regional Baseline",
        "district": "Default Baseline",
        "variety": "Common / Swarna",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "modal_price_per_quintal": value,
        "source": "Configured Local Baseline (BASE_REFERENCE_PRICE_PER_QUINTAL)",
        "source_url": OGD_CATALOG,
        "provider": "local_baseline",
        "status": "default_baseline",
        "is_cached": False,
        "disclaimer": INFORMATIONAL_DISCLAIMER,
        "note": "Local default baseline reference rate. Informational procurement support estimate only.",
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
    commodity_filter = os.getenv("OGD_MANDI_COMMODITY", "").strip()
    if commodity_filter:
        params["filters[commodity]"] = commodity_filter

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
                commodity = str(record.get("commodity", "")).strip().lower()
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
                if state == "andhra pradesh" and "paddy" in commodity and price > 0:
                    valid.append((parsed_date, price, record))
            except (ValueError, TypeError):
                continue

        if valid:
            valid.sort(key=lambda item: item[0], reverse=True)
            parsed_date, price, record = valid[0]
            result = {
                "commodity": record.get("commodity", "Paddy"),
                "market": record.get("market"),
                "district": record.get("district"),
                "variety": record.get("variety"),
                "date": parsed_date.date().isoformat(),
                "modal_price_per_quintal": price,
                "min_price_per_quintal": record.get("min_price"),
                "max_price_per_quintal": record.get("max_price"),
                "source": "AGMARKNET via Government of India Open Government Data Platform",
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
            # Fall back to manual or default baseline
            fallback = _manual_reference() or _default_base_reference()
            return fallback or {
                "available": False,
                "provider": "unconfigured",
                "status": "unconfigured",
                "disclaimer": INFORMATIONAL_DISCLAIMER,
                "note": "Mandi API credentials not configured. Configure OGD_API_KEY or BASE_REFERENCE_PRICE_PER_QUINTAL in .env.",
            }

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

            # Graceful fallback hierarchy:
            # 1. Last cached data if available
            if _MANDI_CACHE["data"] is not None:
                cached = dict(_MANDI_CACHE["data"])
                cached["status"] = "stale_cache_fallback"
                cached["warning"] = f"Upstream refresh failed ({err}). Using previously cached reference."
                return cached

            # 2. Manual reference from .env
            manual = _manual_reference()
            if manual:
                manual["warning"] = f"Upstream mandi API error: {err}. Using manual reference."
                return manual

            # 3. Local default baseline
            baseline = _default_base_reference()
            if baseline:
                baseline["warning"] = f"Upstream mandi API error: {err}. Using local baseline reference."
                return baseline

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

    # Check manual reference
    manual = _manual_reference()
    if manual:
        return manual

    # Check local baseline
    baseline = _default_base_reference()
    if baseline:
        return baseline

    # If cache status indicates upstream error
    if _MANDI_CACHE["last_status"] == "upstream_error":
        return {
            "available": False,
            "provider": "data.gov.in",
            "status": "upstream_error",
            "error_detail": _MANDI_CACHE["last_error"],
            "disclaimer": INFORMATIONAL_DISCLAIMER,
            "note": "Upstream mandi data error logged. Operating in offline baseline mode.",
        }

    return {
        "available": False,
        "provider": "unconfigured",
        "status": "unconfigured",
        "disclaimer": INFORMATIONAL_DISCLAIMER,
        "note": "Mandi price reference uninitialized. Background sync will populate cache or fallback.",
    }


async def background_mandi_scheduler(interval_hours: int = 12) -> None:
    """Async background task that runs for the lifetime of the application."""
    logger.info("Starting background Mandi price cache scheduler (interval: %d hours)...", interval_hours)
    while True:
        try:
            await refresh_mandi_cache(force=True)
        except Exception as exc:
            logger.error("Background mandi scheduler unexpected error: %s", exc, exc_info=True)
        await asyncio.sleep(interval_hours * 3600)
