"""Class-priority metrics, quality score derivation, and transparent procurement pricing formulas.

All quality scores and pricing outputs are strictly designated as
'Estimates for Procurement Decision Support' and NOT officially accredited legal grades.
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

DEFAULT_PRIORITY = [
    "sound", "whole-chalky", "broken-clear", "broken-chalky",
    "unsound", "foreign-object", "stone", "plastic",
]

DECISION_SUPPORT_NOTICE = (
    "Estimate for Procurement Decision Support: Derived purely from computer vision sample metrics. "
    "Not an officially accredited statutory grade or binding purchase commitment."
)


def configured_priority(classes: list[str]) -> list[str]:
    requested = [part.strip().lower() for part in os.getenv("GRAIN_CLASS_PRIORITY", "").split(",") if part.strip()]
    order = requested + [name for name in DEFAULT_PRIORITY if name not in requested]
    order += [name for name in classes if name not in order]
    return [name for name in order if name in classes]


def _configured_class_prices() -> dict[str, float] | None:
    raw = os.getenv("CLASS_PRICE_INR_PER_KG", "").strip()
    if not raw:
        return None
    try:
        prices = {str(k).strip().lower(): float(v) for k, v in json.loads(raw).items()}
        if not prices or any(value < 0 for value in prices.values()):
            return None
        return prices
    except (ValueError, TypeError, AttributeError):
        return None


def calculate_metrics(
    counts: dict[str, int],
    classes: list[str],
    priority: list[str],
    reference_price_per_quintal: Optional[float] = None,
    lot_weight_kg: Optional[float] = None,
) -> dict[str, Any]:
    total = sum(max(0, int(counts.get(name, 0))) for name in classes)
    rows = []
    rank_count = max(1, len(priority) - 1)
    
    # Calculate weighted defect distribution
    for rank, name in enumerate(priority):
        count = max(0, int(counts.get(name, 0)))
        pct = round(count / total * 100, 2) if total else 0.0
        # Weight scales linearly from 100 (top priority, sound grain) down to 0 (severe foreign matter/plastic)
        weight = round(100.0 * (1.0 - (rank / rank_count)), 2)
        rows.append({
            "class": name,
            "count": count,
            "percentage": pct,
            "priority": rank + 1,
            "quality_weight": weight,
        })

    quality_score = round(sum(row["count"] * row["quality_weight"] for row in rows) / total, 2) if total else None

    # Pricing calculation logic:
    # 1. First priority: Explicit approved per-class rate schedule (if provided by procurement officer)
    rates = _configured_class_prices()
    estimated_rate_per_kg = None
    pricing_method = ""
    breakdown = []

    if total and rates and all(name in rates for name in classes):
        estimated_rate_per_kg = round(sum(counts.get(name, 0) * rates[name] for name in priority) / total, 2)
        pricing_method = "Explicit approved per-class schedule rate (INR/kg)"
        breakdown.append({
            "component": "Per-class schedule weighted rate",
            "value": f"₹{estimated_rate_per_kg:.2f} / kg",
            "note": "Averaged across detected grain classes using configured CLASS_PRICE_INR_PER_KG."
        })
    elif reference_price_per_quintal and reference_price_per_quintal > 0 and quality_score is not None:
        # 2. Transparent quality-adjusted procurement estimation from base mandi reference rate
        base_rate_per_kg = round(reference_price_per_quintal / 100.0, 2)
        # Quality factor formula:
        # Baseline reference is calibrated at standard quality (~75 score).
        # Score 100 -> +5% premium over base rate (excellent lot)
        # Score 75 -> 100% of base rate
        # Score 50 -> -15% deduction (moderate defects)
        # Score 0 -> -40% floor deduction (heavy foreign matter/reject tier)
        quality_adjustment_factor = 0.60 + 0.45 * (quality_score / 100.0)
        quality_adjustment_factor = max(0.50, min(1.10, quality_adjustment_factor))
        estimated_rate_per_kg = round(base_rate_per_kg * quality_adjustment_factor, 2)
        pricing_method = "Mandi reference baseline with transparent grain quality adjustment"

        breakdown.append({
            "component": "Base Mandi Reference Rate",
            "value": f"₹{base_rate_per_kg:.2f} / kg (₹{reference_price_per_quintal:.2f} / qtl)",
            "note": "Informational baseline from mandi market indicator."
        })
        adj_pct = round((quality_adjustment_factor - 1.0) * 100, 1)
        breakdown.append({
            "component": "Quality Adjustment",
            "value": f"{'+' if adj_pct >= 0 else ''}{adj_pct}%",
            "note": f"Derived from sample quality score ({quality_score}/100) vs standard grade baseline."
        })
        breakdown.append({
            "component": "Estimated Procurement Rate",
            "value": f"₹{estimated_rate_per_kg:.2f} / kg",
            "note": "Net estimated rate per kg before lot volume scaling."
        })

    # Lot total price estimation
    total_lot_price = None
    if estimated_rate_per_kg is not None and lot_weight_kg is not None and lot_weight_kg > 0:
        total_lot_price = round(estimated_rate_per_kg * lot_weight_kg, 2)
        breakdown.append({
            "component": "Lot Quantity",
            "value": f"{lot_weight_kg:,.1f} kg ({lot_weight_kg / 100.0:.2f} quintals)",
            "note": "Entered procurement lot quantity."
        })
        breakdown.append({
            "component": "Total Estimated Lot Price",
            "value": f"₹{total_lot_price:,.2f}",
            "note": "Estimated procurement lot gross value."
        })

    return {
        "total_grains": total,
        "class_breakdown": rows,
        "quality_score": quality_score,
        "quality_score_label": "Estimate for Procurement Decision Support",
        "priority_schedule_label": "Estimate for Procurement Decision Support",
        "quality_score_method": "Count-weighted class weights derived from procurement priority order; advisory estimate only.",
        "estimated_price_per_kg": estimated_rate_per_kg,
        "estimated_price_per_quintal": round(estimated_rate_per_kg * 100, 2) if estimated_rate_per_kg is not None else None,
        "total_estimated_lot_price": total_lot_price,
        "price_method": pricing_method or "Price unavailable (configure BASE_REFERENCE_PRICE_PER_QUINTAL or CLASS_PRICE_INR_PER_KG)",
        "price_breakdown": breakdown,
        "disclaimer": DECISION_SUPPORT_NOTICE,
    }
