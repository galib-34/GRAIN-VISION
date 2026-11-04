"""Unit tests for Quality Assessment Engine (app.quality_engine)."""
import pytest
from app.quality_engine import (
    MODEL_CLASSES,
    assess_grain_quality,
    calculate_detection_area,
    map_class_to_category,
    STATUTORY_DISCLOSURE,
)


def test_map_class_to_category():
    assert map_class_to_category("sound") == "normal"
    assert map_class_to_category("broken-clear") == "broken"
    assert map_class_to_category("broken-chalky") == "broken"
    assert map_class_to_category("whole-chalky") == "chalky"
    assert map_class_to_category("unsound") == "discolored"
    assert map_class_to_category("foreign-object") == "discolored"
    assert map_class_to_category("stone") == "discolored"
    assert map_class_to_category("plastic") == "discolored"


def test_broken_chalky_non_exclusive_no_denominator_double_counting():
    """Verify broken-chalky contributes to both broken and chalky counts,
    while total_grains denominator remains strictly 10.
    """
    detections = [
        # 6 sound grains
        {"class": "sound", "confidence": 0.95, "box": {"x1": 10, "y1": 10, "x2": 30, "y2": 50}},
        {"class": "sound", "confidence": 0.92, "box": {"x1": 40, "y1": 10, "x2": 60, "y2": 50}},
        {"class": "sound", "confidence": 0.94, "box": {"x1": 70, "y1": 10, "x2": 90, "y2": 50}},
        {"class": "sound", "confidence": 0.91, "box": {"x1": 10, "y1": 60, "x2": 30, "y2": 100}},
        {"class": "sound", "confidence": 0.93, "box": {"x1": 40, "y1": 60, "x2": 60, "y2": 100}},
        {"class": "sound", "confidence": 0.90, "box": {"x1": 70, "y1": 60, "x2": 90, "y2": 100}},
        # 1 broken-clear
        {"class": "broken-clear", "confidence": 0.88, "box": {"x1": 10, "y1": 110, "x2": 25, "y2": 130}},
        # 1 whole-chalky
        {"class": "whole-chalky", "confidence": 0.85, "box": {"x1": 40, "y1": 110, "x2": 60, "y2": 150}},
        # 2 broken-chalky (contributes to both broken and chalky!)
        {"class": "broken-chalky", "confidence": 0.87, "box": {"x1": 70, "y1": 110, "x2": 85, "y2": 130}},
        {"class": "broken-chalky", "confidence": 0.86, "box": {"x1": 10, "y1": 160, "x2": 25, "y2": 180}},
    ]

    metrics = assess_grain_quality(detections)

    # Total grain count must be exactly 10 (no double counting!)
    assert metrics["total_grains"] == 10

    # Broken count = 1 broken-clear + 2 broken-chalky = 3
    assert metrics["broken_count"] == 3
    assert metrics["broken_pct"] == 30.0

    # Chalky count = 1 whole-chalky + 2 broken-chalky = 3
    assert metrics["chalky_count"] == 3
    assert metrics["chalky_pct"] == 30.0

    # Sound count = 6
    assert metrics["sound_count"] == 6
    assert metrics["sound_pct"] == 60.0


def test_mass_approximation_via_pixel_area():
    """Verify that indicative mass approximations scale with bounding box area."""
    # Large sound grain (area = 50x100 = 5000)
    # Small broken grain (area = 10x10 = 100)
    detections = [
        {"class": "sound", "confidence": 0.95, "box": {"x1": 0, "y1": 0, "x2": 50, "y2": 100}},
        {"class": "broken-clear", "confidence": 0.90, "box": {"x1": 0, "y1": 0, "x2": 10, "y2": 10}},
    ]
    metrics = assess_grain_quality(detections)

    assert metrics["total_grains"] == 2
    assert metrics["sound_pct"] == 50.0
    assert metrics["broken_pct"] == 50.0

    # But sound mass should dominate (~5000 / 5100 = 98.04%)
    assert metrics["sound_mass_pct"] > 95.0
    assert metrics["broken_mass_pct"] < 5.0


def test_commercial_grade_classification():
    # Pristine sample -> Grade A
    perfect_detections = [
        {"class": "sound", "confidence": 0.95, "box": {"x1": 0, "y1": 0, "x2": 20, "y2": 40}}
        for _ in range(50)
    ]
    grade_a_metrics = assess_grain_quality(perfect_detections)
    assert grade_a_metrics["quality_score"] >= 80.0
    assert grade_a_metrics["grade"] == "Grade A"

    # Heavily broken sample -> Grade B or C
    damaged_detections = [
        {"class": "sound", "confidence": 0.90, "box": {"x1": 0, "y1": 0, "x2": 20, "y2": 40}}
        for _ in range(20)
    ] + [
        {"class": "broken-chalky", "confidence": 0.85, "box": {"x1": 0, "y1": 0, "x2": 20, "y2": 30}}
        for _ in range(20)
    ] + [
        {"class": "unsound", "confidence": 0.80, "box": {"x1": 0, "y1": 0, "x2": 20, "y2": 40}}
        for _ in range(10)
    ]
    low_metrics = assess_grain_quality(damaged_detections)
    assert low_metrics["grade"] in ["Grade B", "Grade C"]


def test_statutory_disclosure_present():
    metrics = assess_grain_quality([])
    assert "UNCERTIFIED_ESTIMATION_DEVICE" in metrics["disclaimer"]
