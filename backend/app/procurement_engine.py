"""Optimized Procurement Decision Engine for GRAIN-VISION.

Executes transparent agricultural pricing calculations using tiered slab deductions,
applies statutory tolerance thresholds, enforces hard-stop rejection rules for
contamination, and outputs actionable trade recommendations (BUY, NEGOTIATE, REJECT).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("grain_vision.procurement_engine")

COMPLIANCE_DISCLOSURE = (
    "UNCERTIFIED_ESTIMATION_DEVICE — Ratios and mass values are uncertified "
    "mathematical approximations for screening purposes only."
)

# Standard statutory tolerance thresholds (Free allowances before penalties kick in)
TOLERANCE_BROKEN_PCT = 5.0       # 5.0% broken allowance
TOLERANCE_CHALKY_PCT = 3.0       # 3.0% chalky allowance
TOLERANCE_DISCOLORED_PCT = 1.0   # 1.0% discolored/unsound allowance

# Hard-Stop Rejection Thresholds
REJECT_FOREIGN_MATTER_PCT = 1.5  # Stone, plastic, or foreign matter > 1.5%
REJECT_BROKEN_PCT = 35.0         # Broken grains > 35.0%
REJECT_MIN_QUALITY_SCORE = 50.0  # Composite quality score < 50.0


def calculate_broken_slab_deduction(broken_pct: float) -> Tuple[float, List[str]]:
    """Calculates tiered slab price deduction for broken rice grains."""
    excess = max(0.0, broken_pct - TOLERANCE_BROKEN_PCT)
    if excess <= 0.0:
        return 0.0, [f"Broken grain ratio ({broken_pct:.1f}%) within standard tolerance ({TOLERANCE_BROKEN_PCT}%). No deduction applied."]

    deduction_pct = 0.0
    logs = [f"Broken grain excess over tolerance: {excess:.2f}% (Actual: {broken_pct:.1f}%, Tolerance: {TOLERANCE_BROKEN_PCT}%)."]

    # Slab 1: 5.0% to 15.0% (first 10.0% excess) -> 0.5% deduction per 1.0% excess
    slab1_excess = min(excess, 10.0)
    slab1_deduction = slab1_excess * 0.50
    deduction_pct += slab1_deduction
    logs.append(f"  • Slab 1 (5%-15%): {slab1_excess:.2f}% excess × 0.5% = -{slab1_deduction:.2f}% deduction.")

    # Slab 2: 15.0% to 25.0% (next 10.0% excess) -> 1.0% deduction per 1.0% excess
    if excess > 10.0:
        slab2_excess = min(excess - 10.0, 10.0)
        slab2_deduction = slab2_excess * 1.00
        deduction_pct += slab2_deduction
        logs.append(f"  • Slab 2 (15%-25%): {slab2_excess:.2f}% excess × 1.0% = -{slab2_deduction:.2f}% deduction.")

    # Slab 3: > 25.0% (excess beyond 20.0%) -> 1.5% deduction per 1.0% excess
    if excess > 20.0:
        slab3_excess = excess - 20.0
        slab3_deduction = slab3_excess * 1.50
        deduction_pct += slab3_deduction
        logs.append(f"  • Slab 3 (>25%): {slab3_excess:.2f}% excess × 1.5% = -{slab3_deduction:.2f}% deduction.")

    return round(deduction_pct, 2), logs


def calculate_chalky_slab_deduction(chalky_pct: float) -> Tuple[float, List[str]]:
    """Calculates tiered slab price deduction for chalky rice grains."""
    excess = max(0.0, chalky_pct - TOLERANCE_CHALKY_PCT)
    if excess <= 0.0:
        return 0.0, [f"Chalky grain ratio ({chalky_pct:.1f}%) within standard tolerance ({TOLERANCE_CHALKY_PCT}%). No deduction applied."]

    deduction_pct = 0.0
    logs = [f"Chalky grain excess over tolerance: {excess:.2f}% (Actual: {chalky_pct:.1f}%, Tolerance: {TOLERANCE_CHALKY_PCT}%)."]

    # Slab 1: 3.0% to 10.0% (first 7.0% excess) -> 0.4% deduction per 1.0% excess
    slab1_excess = min(excess, 7.0)
    slab1_deduction = slab1_excess * 0.40
    deduction_pct += slab1_deduction
    logs.append(f"  • Slab 1 (3%-10%): {slab1_excess:.2f}% excess × 0.4% = -{slab1_deduction:.2f}% deduction.")

    # Slab 2: > 10.0% (excess beyond 7.0%) -> 0.8% deduction per 1.0% excess
    if excess > 7.0:
        slab2_excess = excess - 7.0
        slab2_deduction = slab2_excess * 0.80
        deduction_pct += slab2_deduction
        logs.append(f"  • Slab 2 (>10%): {slab2_excess:.2f}% excess × 0.8% = -{slab2_deduction:.2f}% deduction.")

    return round(deduction_pct, 2), logs


def calculate_discolored_slab_deduction(discolored_pct: float) -> Tuple[float, List[str]]:
    """Calculates tiered slab price deduction for discolored / unsound rice grains."""
    excess = max(0.0, discolored_pct - TOLERANCE_DISCOLORED_PCT)
    if excess <= 0.0:
        return 0.0, [f"Discolored grain ratio ({discolored_pct:.1f}%) within standard tolerance ({TOLERANCE_DISCOLORED_PCT}%). No deduction applied."]

    deduction_pct = 0.0
    logs = [f"Discolored grain excess over tolerance: {excess:.2f}% (Actual: {discolored_pct:.1f}%, Tolerance: {TOLERANCE_DISCOLORED_PCT}%)."]

    # Slab 1: 1.0% to 5.0% (first 4.0% excess) -> 1.5% deduction per 1.0% excess
    slab1_excess = min(excess, 4.0)
    slab1_deduction = slab1_excess * 1.50
    deduction_pct += slab1_deduction
    logs.append(f"  • Slab 1 (1%-5%): {slab1_excess:.2f}% excess × 1.5% = -{slab1_deduction:.2f}% deduction.")

    # Slab 2: > 5.0% (excess beyond 4.0%) -> 2.5% deduction per 1.0% excess
    if excess > 4.0:
        slab2_excess = excess - 4.0
        slab2_deduction = slab2_excess * 2.50
        deduction_pct += slab2_deduction
        logs.append(f"  • Slab 2 (>5%): {slab2_excess:.2f}% excess × 2.5% = -{slab2_deduction:.2f}% deduction.")

    return round(deduction_pct, 2), logs


def evaluate_procurement(
    quality_metrics: Dict[str, Any],
    base_rate_per_quintal: float = 2320.0,
    lot_weight_kg: Optional[float] = None,
    variety: Optional[str] = "Swarna (Common)",
    inspector_offer_price: Optional[float] = None,
) -> Dict[str, Any]:
    """Evaluates sample quality against agricultural commercial procurement standards.

    Returns:
    - recommendation: 'BUY' | 'NEGOTIATE' | 'REJECT'
    - price breakdown with tiered slab deductions
    - transparent explanation logs
    - statutory compliance disclosure
    """
    broken_pct = float(quality_metrics.get("broken_pct", 0.0))
    broken_mass_pct = float(quality_metrics.get("broken_mass_pct", 0.0))
    chalky_pct = float(quality_metrics.get("chalky_pct", 0.0))
    discolored_pct = float(quality_metrics.get("discolored_pct", 0.0))
    foreign_matter_count_pct = float(quality_metrics.get("foreign_matter_count_pct", 0.0))
    foreign_matter_mass_pct = float(quality_metrics.get("foreign_matter_mass_pct", 0.0))
    quality_score = float(quality_metrics.get("quality_score", 0.0))

    base_rate_per_kg = round(base_rate_per_quintal / 100.0, 2)
    weight_kg = float(lot_weight_kg) if lot_weight_kg and lot_weight_kg > 0 else 0.0
    weight_quintals = round(weight_kg / 100.0, 2)

    explanation_logs: List[str] = [
        f"Procurement evaluation initialized for variety '{variety}'.",
        f"Base Mandi Reference Rate: ₹{base_rate_per_kg:.2f} / kg (₹{base_rate_per_quintal:.2f} / quintal).",
        f"Sample Quality Score: {quality_score:.1f} / 100 ({quality_metrics.get('grade', 'Unassigned')}).",
    ]

    rejection_reasons: List[str] = []

    # HARD-STOP REJECTION RULE 1: Foreign Contamination (Stone / Plastic / Foreign Object)
    max_foreign = max(foreign_matter_count_pct, foreign_matter_mass_pct)
    if max_foreign > REJECT_FOREIGN_MATTER_PCT:
        rejection_reasons.append(
            f"Foreign matter / stone / plastic ({max_foreign:.2f}%) exceeds hard statutory ceiling of {REJECT_FOREIGN_MATTER_PCT}%."
        )

    # HARD-STOP REJECTION RULE 2: Broken Grains Ratio
    max_broken = max(broken_pct, broken_mass_pct)
    if max_broken > REJECT_BROKEN_PCT:
        rejection_reasons.append(
            f"Broken grains ({max_broken:.1f}%) exceeds commercial milling rejection threshold of {REJECT_BROKEN_PCT}%."
        )

    # HARD-STOP REJECTION RULE 3: Composite Quality Score Floor
    if quality_score < REJECT_MIN_QUALITY_SCORE:
        rejection_reasons.append(
            f"Overall sample quality score ({quality_score:.1f}) is below minimal intake threshold ({REJECT_MIN_QUALITY_SCORE})."
        )

    # Calculate tiered slab deductions
    broken_ded_pct, broken_logs = calculate_broken_slab_deduction(broken_pct)
    chalky_ded_pct, chalky_logs = calculate_chalky_slab_deduction(chalky_pct)
    discolored_ded_pct, discolored_logs = calculate_discolored_slab_deduction(discolored_pct)

    explanation_logs.extend(broken_logs)
    explanation_logs.extend(chalky_logs)
    explanation_logs.extend(discolored_logs)

    total_deduction_pct = round(broken_ded_pct + chalky_ded_pct + discolored_ded_pct, 2)

    # Convert percentage deductions to line-item rupee deductions
    broken_ded_inr = round(base_rate_per_kg * (broken_ded_pct / 100.0), 2)
    chalky_ded_inr = round(base_rate_per_kg * (chalky_ded_pct / 100.0), 2)
    discolored_ded_inr = round(base_rate_per_kg * (discolored_ded_pct / 100.0), 2)
    total_ded_inr = round(base_rate_per_kg * (total_deduction_pct / 100.0), 2)

    deductions_list = [
        {
            "name": "Broken Grains Deduction",
            "tolerance_pct": TOLERANCE_BROKEN_PCT,
            "actual_pct": broken_pct,
            "excess_pct": max(0.0, round(broken_pct - TOLERANCE_BROKEN_PCT, 2)),
            "deduction_percentage": broken_ded_pct,
            "deduction_per_kg_inr": broken_ded_inr,
            "note": "Tiered slab penalty applied only on broken grains exceeding 5.0% tolerance.",
        },
        {
            "name": "Chalkiness Deduction",
            "tolerance_pct": TOLERANCE_CHALKY_PCT,
            "actual_pct": chalky_pct,
            "excess_pct": max(0.0, round(chalky_pct - TOLERANCE_CHALKY_PCT, 2)),
            "deduction_percentage": chalky_ded_pct,
            "deduction_per_kg_inr": chalky_ded_inr,
            "note": "Tiered slab penalty applied only on chalky grains exceeding 3.0% tolerance.",
        },
        {
            "name": "Discolored / Unsound Deduction",
            "tolerance_pct": TOLERANCE_DISCOLORED_PCT,
            "actual_pct": discolored_pct,
            "excess_pct": max(0.0, round(discolored_pct - TOLERANCE_DISCOLORED_PCT, 2)),
            "deduction_percentage": discolored_ded_pct,
            "deduction_per_kg_inr": discolored_ded_inr,
            "note": "Penalty applied on discolored grains exceeding 1.0% tolerance.",
        },
    ]

    # Quality Premium logic: pristine Grade A sample with 0 deductions receives premium
    quality_premium_pct = 0.0
    quality_premium_inr = 0.0
    if total_deduction_pct == 0.0 and quality_score >= 85.0:
        quality_premium_pct = 2.0  # +2.0% quality incentive
        quality_premium_inr = round(base_rate_per_kg * (quality_premium_pct / 100.0), 2)
        explanation_logs.append(
            f"High-quality sample incentive: +{quality_premium_pct}% (₹{quality_premium_inr:.2f}/kg) awarded for pristine Grade A paddy."
        )

    # Determine final recommendation and net price
    if rejection_reasons:
        recommendation = "REJECT"
        estimated_rate_per_kg = 0.0
        target_negotiation_rate = 0.0
        total_lot_price = 0.0
        explanation_logs.append(f"DETERMINATION: REJECT. Reasons: {' | '.join(rejection_reasons)}")
    elif total_deduction_pct <= 5.0 and quality_score >= 75.0:
        recommendation = "BUY"
        net_rate = base_rate_per_kg - total_ded_inr + quality_premium_inr
        estimated_rate_per_kg = round(max(base_rate_per_kg * 0.50, net_rate), 2)
        target_negotiation_rate = estimated_rate_per_kg
        total_lot_price = round(estimated_rate_per_kg * weight_kg, 2) if weight_kg > 0 else 0.0
        explanation_logs.append(
            f"DETERMINATION: BUY. Quality within acceptable procurement parameters. Recommended rate: ₹{estimated_rate_per_kg:.2f} / kg."
        )
    else:
        recommendation = "NEGOTIATE"
        net_rate = base_rate_per_kg - total_ded_inr
        estimated_rate_per_kg = round(max(base_rate_per_kg * 0.50, net_rate), 2)
        # Suggested target negotiation counter-rate
        target_negotiation_rate = estimated_rate_per_kg
        total_lot_price = round(estimated_rate_per_kg * weight_kg, 2) if weight_kg > 0 else 0.0
        explanation_logs.append(
            f"DETERMINATION: NEGOTIATE. Sample defects warrant total price discount of -{total_deduction_pct}%. Counter with target rate: ₹{target_negotiation_rate:.2f} / kg."
        )

    return {
        "recommendation": recommendation,
        "rejection_reasons": rejection_reasons,
        "base_rate_per_quintal": base_rate_per_quintal,
        "base_rate_per_kg": base_rate_per_kg,
        "total_deduction_percentage": total_deduction_pct,
        "total_deduction_per_kg_inr": total_ded_inr,
        "quality_premium_percentage": quality_premium_pct,
        "quality_premium_per_kg_inr": quality_premium_inr,
        "estimated_rate_per_kg": estimated_rate_per_kg,
        "estimated_rate_per_quintal": round(estimated_rate_per_kg * 100.0, 2),
        "target_negotiation_rate_per_kg": target_negotiation_rate,
        "lot_weight_kg": weight_kg,
        "lot_weight_quintals": weight_quintals,
        "total_estimated_lot_price": total_lot_price,
        "deductions": deductions_list,
        "explanation_logs": explanation_logs,
        "compliance_disclosure": COMPLIANCE_DISCLOSURE,
    }
