"""Quality Assessment Engine for GRAIN-VISION.

Converts raw YOLOv8 8-class detections into commercial quality metrics,
explicitly addressing the non-exclusive nature of 'broken-chalky'
(contributing to both broken and chalky metrics without double-counting
the total grain denominator). Computes count percentages, indicative
mass approximations (via bounding box pixel area proxies), and assigns
commercial grades (Grade A, Grade B, Grade C).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("grain_vision.quality_engine")

# The 8 trained YOLOv8 model classes
MODEL_CLASSES = [
    "broken-chalky",
    "broken-clear",
    "foreign-object",
    "plastic",
    "sound",
    "stone",
    "unsound",
    "whole-chalky",
]

# Classification category taxonomy
CATEGORY_NORMAL = "normal"
CATEGORY_BROKEN = "broken"
CATEGORY_CHALKY = "chalky"
CATEGORY_DISCOLORED = "discolored"

# Statutory and regulatory disclosure
STATUTORY_DISCLOSURE = (
    "UNCERTIFIED_ESTIMATION_DEVICE — Ratios and mass values are uncertified "
    "mathematical approximations for screening purposes only. Derived from "
    "computer vision defect distribution; decision-support estimate."
)

# Relative quality weights for scoring formula (sound = 100, defects penalized)
CLASS_QUALITY_WEIGHTS: Dict[str, float] = {
    "sound": 100.0,
    "whole-chalky": 80.0,
    "broken-clear": 70.0,
    "broken-chalky": 55.0,
    "unsound": 35.0,
    "foreign-object": 0.0,
    "stone": 0.0,
    "plastic": 0.0,
}

# Commercial category mappings
CLASS_TO_CATEGORY: Dict[str, str] = {
    "sound": CATEGORY_NORMAL,
    "broken-clear": CATEGORY_BROKEN,
    "broken-chalky": CATEGORY_BROKEN,  # Also contributes to chalky metric
    "whole-chalky": CATEGORY_CHALKY,
    "unsound": CATEGORY_DISCOLORED,
    "foreign-object": CATEGORY_DISCOLORED,
    "stone": CATEGORY_DISCOLORED,
    "plastic": CATEGORY_DISCOLORED,
}

# Foreign matter specific set (for strict contamination checks)
FOREIGN_MATTER_CLASSES = {"foreign-object", "stone", "plastic"}


def map_class_to_category(raw_class: str) -> str:
    """Maps raw YOLO class to high-level UI/commercial category."""
    normalized = (raw_class or "").strip().lower()
    return CLASS_TO_CATEGORY.get(normalized, CATEGORY_DISCOLORED)


def calculate_detection_area(box: Dict[str, float]) -> float:
    """Calculates pixel area for a bounding box as an indicative proxy for grain mass."""
    x1 = float(box.get("x1", 0.0))
    y1 = float(box.get("y1", 0.0))
    x2 = float(box.get("x2", 0.0))
    y2 = float(box.get("y2", 0.0))
    width = max(0.0, x2 - x1)
    height = max(0.0, y2 - y1)
    return width * height


def assess_grain_quality(
    detections: List[Dict[str, Any]],
    img_width: int = 1080,
    img_height: int = 1920,
) -> Dict[str, Any]:
    """Analyzes raw YOLO detections to produce commercial grain quality metrics.

    Mathematical Rigor:
    - total_grains is the actual count of all detected objects in the sample.
    - 'broken-chalky' contributes simultaneously to broken metrics and chalky metrics,
      but DOES NOT double-count the total grain denominator.
    - Indicative mass approximations use bounding box pixel areas as geometric mass proxies.
    """
    total_grains = len(detections)

    # Initialize count and area aggregations
    class_counts: Dict[str, int] = {cls: 0 for cls in MODEL_CLASSES}
    class_areas: Dict[str, float] = {cls: 0.0 for cls in MODEL_CLASSES}

    total_pixel_area = 0.0

    for det in detections:
        raw_class = str(det.get("class", "")).strip().lower()
        if raw_class not in class_counts:
            # Fallback for unexpected or alias class name
            if "sound" in raw_class:
                raw_class = "sound"
            elif "chalky" in raw_class and "broken" in raw_class:
                raw_class = "broken-chalky"
            elif "broken" in raw_class:
                raw_class = "broken-clear"
            elif "chalky" in raw_class:
                raw_class = "whole-chalky"
            elif "stone" in raw_class:
                raw_class = "stone"
            elif "plastic" in raw_class:
                raw_class = "plastic"
            elif "foreign" in raw_class:
                raw_class = "foreign-object"
            else:
                raw_class = "unsound"

        box = det.get("box", {})
        area = calculate_detection_area(box)

        class_counts[raw_class] += 1
        class_areas[raw_class] += area
        total_pixel_area += area

    if total_grains == 0:
        # Graceful empty sample response
        return {
            "total_grains": 0,
            "sound_count": 0,
            "broken_count": 0,
            "chalky_count": 0,
            "discolored_count": 0,
            "foreign_matter_count": 0,
            "sound_pct": 0.0,
            "broken_pct": 0.0,
            "chalky_pct": 0.0,
            "discolored_pct": 0.0,
            "foreign_matter_count_pct": 0.0,
            "sound_mass_pct": 0.0,
            "broken_mass_pct": 0.0,
            "chalky_mass_pct": 0.0,
            "discolored_mass_pct": 0.0,
            "foreign_matter_mass_pct": 0.0,
            "quality_score": 0.0,
            "grade": "Grade C",
            "class_breakdown": [],
            "disclaimer": STATUTORY_DISCLOSURE,
        }

    # Category count derivations
    # Non-exclusive broken-chalky contributes to BOTH broken and chalky counts
    sound_count = class_counts["sound"]
    broken_count = class_counts["broken-clear"] + class_counts["broken-chalky"]
    chalky_count = class_counts["whole-chalky"] + class_counts["broken-chalky"]
    discolored_count = (
        class_counts["unsound"]
        + class_counts["foreign-object"]
        + class_counts["stone"]
        + class_counts["plastic"]
    )
    foreign_matter_count = (
        class_counts["foreign-object"]
        + class_counts["stone"]
        + class_counts["plastic"]
    )

    # Count percentages (Normalized strictly against total_grains denominator)
    sound_pct = round((sound_count / total_grains) * 100.0, 2)
    broken_pct = round((broken_count / total_grains) * 100.0, 2)
    chalky_pct = round((chalky_count / total_grains) * 100.0, 2)
    discolored_pct = round((discolored_count / total_grains) * 100.0, 2)
    foreign_matter_count_pct = round((foreign_matter_count / total_grains) * 100.0, 2)

    # Indicative mass percentages via bounding box pixel area proxy
    area_denom = max(1.0, total_pixel_area)
    sound_area = class_areas["sound"]
    broken_area = class_areas["broken-clear"] + class_areas["broken-chalky"]
    chalky_area = class_areas["whole-chalky"] + class_areas["broken-chalky"]
    discolored_area = (
        class_areas["unsound"]
        + class_areas["foreign-object"]
        + class_areas["stone"]
        + class_areas["plastic"]
    )
    foreign_matter_area = (
        class_areas["foreign-object"]
        + class_areas["stone"]
        + class_areas["plastic"]
    )

    sound_mass_pct = round((sound_area / area_denom) * 100.0, 2)
    broken_mass_pct = round((broken_area / area_denom) * 100.0, 2)
    chalky_mass_pct = round((chalky_area / area_denom) * 100.0, 2)
    discolored_mass_pct = round((discolored_area / area_denom) * 100.0, 2)
    foreign_matter_mass_pct = round((foreign_matter_area / area_denom) * 100.0, 2)

    # Detailed per-class breakdown
    class_breakdown = []
    weighted_score_sum = 0.0

    for cls in MODEL_CLASSES:
        cnt = class_counts[cls]
        cls_area = class_areas[cls]
        cnt_pct = round((cnt / total_grains) * 100.0, 2)
        mass_pct = round((cls_area / area_denom) * 100.0, 2)
        weight = CLASS_QUALITY_WEIGHTS.get(cls, 0.0)

        weighted_score_sum += cnt * weight

        class_breakdown.append({
            "class": cls,
            "category": map_class_to_category(cls),
            "count": cnt,
            "percentage": cnt_pct,
            "mass_percentage": mass_pct,
            "pixel_area": round(cls_area, 1),
            "quality_weight": weight,
        })

    # Raw count-weighted quality score
    base_quality_score = weighted_score_sum / total_grains

    # Fine adjustment: penalize high mass-defect concentration
    # If broken mass is significantly larger than count (large broken fragments)
    # or foreign matter mass is detected
    mass_penalty = 0.0
    if foreign_matter_mass_pct > 0.0:
        mass_penalty += foreign_matter_mass_pct * 3.0
    if broken_mass_pct > broken_pct:
        mass_penalty += (broken_mass_pct - broken_pct) * 0.2

    final_quality_score = max(0.0, min(100.0, round(base_quality_score - mass_penalty, 1)))

    # Commercial Grade Derivation:
    # Grade A: Score >= 80 (Export / Premium procurement tier)
    # Grade B: 60 <= Score < 80 (Standard commercial milling tier)
    # Grade C: Score < 60 (High defect / Rejected tier)
    if final_quality_score >= 80.0:
        grade = "Grade A"
    elif final_quality_score >= 60.0:
        grade = "Grade B"
    else:
        grade = "Grade C"

    return {
        "total_grains": total_grains,
        "sound_count": sound_count,
        "broken_count": broken_count,
        "chalky_count": chalky_count,
        "discolored_count": discolored_count,
        "foreign_matter_count": foreign_matter_count,
        "sound_pct": sound_pct,
        "broken_pct": broken_pct,
        "chalky_pct": chalky_pct,
        "discolored_pct": discolored_pct,
        "foreign_matter_count_pct": foreign_matter_count_pct,
        "sound_mass_pct": sound_mass_pct,
        "broken_mass_pct": broken_mass_pct,
        "chalky_mass_pct": chalky_mass_pct,
        "discolored_mass_pct": discolored_mass_pct,
        "foreign_matter_mass_pct": foreign_matter_mass_pct,
        "quality_score": final_quality_score,
        "grade": grade,
        "class_breakdown": class_breakdown,
        "disclaimer": STATUTORY_DISCLOSURE,
    }
