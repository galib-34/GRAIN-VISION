"""Request and response schemas for persisted procurement transactions."""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, validator


class LotTransactionCreate(BaseModel):
    farmer_id: Optional[str] = None
    farmer_name: str = ""
    grain_type: str = "Swarna Paddy"
    net_weight_kg: float = Field(gt=0, le=500_000)
    fci_valuation: dict[str, Any]

    @validator("fci_valuation")
    def validate_moisture_bounds(cls, valuation: dict[str, Any]) -> dict[str, Any]:
        mass = valuation.get("mass_percentages") or {}
        moisture = mass.get("moisture_pct", mass.get("moisture"))
        if moisture is not None:
            try:
                value = float(moisture)
            except (TypeError, ValueError) as exc:
                raise ValueError("Moisture percentage must be numeric.") from exc
            if not 5 <= value <= 35:
                raise ValueError("Moisture percentage must be between 5% and 35%.")
        return valuation


class GoogleTokenPayload(BaseModel):
    token: str = Field(min_length=1, max_length=16_384)


class LotTransactionRecord(BaseModel):
    id: str
    timestamp: str
    farmer_id: Optional[str]
    farmer_name: str
    grain_type: str
    status: Literal["BUY", "BUY_WITH_CUT", "REJECT"]
    grade: str
    net_weight_kg: float
    base_rate_per_quintal: float
    effective_rate_per_kg: float
    total_payout: float
    total_deduction_per_kg: float
    mass_percentages: dict[str, Any]
    deductions: list[dict[str, Any]]
    rejection_reasons: list[str]


class DashboardMetrics(BaseModel):
    total_lots_assessed: int
    total_lots_accepted: int
    total_lots_rejected: int
    total_procurement_value: float
    total_procured_weight_quintals: float
