"""Unit tests for Optimized Procurement Decision Engine (app.procurement_engine)."""
import pytest
from app.procurement_engine import (
    COMPLIANCE_DISCLOSURE,
    TOLERANCE_BROKEN_PCT,
    TOLERANCE_CHALKY_PCT,
    calculate_broken_slab_deduction,
    calculate_chalky_slab_deduction,
    evaluate_procurement,
)


def test_tolerance_free_allowance():
    """Broken <= 5.0% and Chalky <= 3.0% must have zero deductions."""
    ded_broken, _ = calculate_broken_slab_deduction(4.5)
    assert ded_broken == 0.0

    ded_chalky, _ = calculate_chalky_slab_deduction(2.8)
    assert ded_chalky == 0.0


def test_broken_slab_calculations():
    # Broken 10% -> 5% excess in slab 1 (5% to 15%) at 0.5% = 2.5% deduction
    ded_10, _ = calculate_broken_slab_deduction(10.0)
    assert ded_10 == 2.50

    # Broken 18% -> 13% excess
    # Slab 1: 10% excess * 0.5% = 5.0%
    # Slab 2: 3% excess * 1.0% = 3.0%
    # Total = 8.0%
    ded_18, _ = calculate_broken_slab_deduction(18.0)
    assert ded_18 == 8.00


def test_hard_stop_rejection_foreign_matter():
    """Foreign matter exceeding 1.5% must trigger hard-stop REJECT determination."""
    sample_metrics = {
        "broken_pct": 4.0,
        "broken_mass_pct": 4.0,
        "chalky_pct": 2.0,
        "discolored_pct": 0.5,
        "foreign_matter_count_pct": 2.2,  # > 1.5% limit!
        "foreign_matter_mass_pct": 2.0,
        "quality_score": 78.0,
        "grade": "Grade B",
    }
    decision = evaluate_procurement(sample_metrics, base_rate_per_quintal=2400.0)
    assert decision["recommendation"] == "REJECT"
    assert any("Foreign matter" in r for r in decision["rejection_reasons"])
    assert decision["estimated_rate_per_kg"] == 0.0


def test_hard_stop_rejection_excessive_broken():
    """Broken grains exceeding 35% must trigger hard-stop REJECT."""
    sample_metrics = {
        "broken_pct": 38.0,  # > 35% limit!
        "broken_mass_pct": 36.0,
        "chalky_pct": 4.0,
        "discolored_pct": 0.5,
        "foreign_matter_count_pct": 0.0,
        "foreign_matter_mass_pct": 0.0,
        "quality_score": 62.0,
        "grade": "Grade B",
    }
    decision = evaluate_procurement(sample_metrics, base_rate_per_quintal=2400.0)
    assert decision["recommendation"] == "REJECT"
    assert any("Broken grains" in r for r in decision["rejection_reasons"])


def test_buy_determination_pristine_lot():
    """Low defect, high quality score lot results in BUY recommendation."""
    sample_metrics = {
        "broken_pct": 3.0,  # within 5% tolerance
        "broken_mass_pct": 3.0,
        "chalky_pct": 1.5,  # within 3% tolerance
        "discolored_pct": 0.2,
        "foreign_matter_count_pct": 0.0,
        "foreign_matter_mass_pct": 0.0,
        "quality_score": 92.0,
        "grade": "Grade A",
    }
    decision = evaluate_procurement(
        sample_metrics,
        base_rate_per_quintal=2300.0,
        lot_weight_kg=1000.0,
        variety="Swarna Paddy",
    )
    assert decision["recommendation"] == "BUY"
    assert decision["total_deduction_percentage"] == 0.0
    assert decision["quality_premium_percentage"] > 0.0
    assert decision["estimated_rate_per_kg"] >= 23.0
    assert decision["total_estimated_lot_price"] > 23000.0


def test_negotiate_determination_moderate_defects():
    """Moderate defects trigger NEGOTIATE with a recommended discount."""
    sample_metrics = {
        "broken_pct": 16.0,  # 11% excess
        "broken_mass_pct": 15.0,
        "chalky_pct": 7.0,   # 4% excess
        "discolored_pct": 1.5,
        "foreign_matter_count_pct": 0.2,
        "foreign_matter_mass_pct": 0.2,
        "quality_score": 68.0,
        "grade": "Grade B",
    }
    decision = evaluate_procurement(
        sample_metrics,
        base_rate_per_quintal=2300.0,
        lot_weight_kg=500.0,
    )
    assert decision["recommendation"] == "NEGOTIATE"
    assert decision["total_deduction_percentage"] > 5.0
    assert decision["target_negotiation_rate_per_kg"] < 23.0
    assert decision["total_estimated_lot_price"] > 0.0


def test_compliance_disclosure_present():
    decision = evaluate_procurement({}, base_rate_per_quintal=2000.0)
    assert "UNCERTIFIED_ESTIMATION_DEVICE" in decision["compliance_disclosure"]
