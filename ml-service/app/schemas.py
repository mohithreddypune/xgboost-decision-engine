"""Request / response models for the ML service."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ScoreRequest(BaseModel):
    transaction_id: str = Field(..., description="Caller-provided unique id")
    amount: float
    merchant_category: int
    hour_of_day: int = Field(..., ge=0, le=23)
    is_weekend: int = Field(..., ge=0, le=1)
    txn_count_1h: int = Field(..., ge=0)
    amount_zscore_user: float
    device_risk_score: float = Field(..., ge=0.0, le=1.0)
    geo_distance_km: float = Field(..., ge=0.0)


class ScoreResponse(BaseModel):
    transaction_id: str
    score: float
    model_version: str
    latency_ms: float


class HealthResponse(BaseModel):
    status: str
    model_version: str
    drift_reference_loaded: bool


class DriftResponse(BaseModel):
    max_psi: float
    per_feature: dict[str, float]
    samples: int
    drifted: bool
    threshold: float


class RetrainResponse(BaseModel):
    status: str
    version: Optional[str] = None
    val_auc: Optional[float] = None
    train_seconds: Optional[float] = None
    reason: Optional[str] = None


class BatchScoreRequest(BaseModel):
    transactions: List[ScoreRequest]


class BatchScoreResponse(BaseModel):
    model_version: str
    count: int
    latency_ms: float
    scores: List[ScoreResponse]


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float  # positive = pushes toward fraud, negative = away
    direction: str       # "fraud" or "clean"


class ExplainResponse(BaseModel):
    transaction_id: str
    score: float
    model_version: str
    base_value: float    # the model's average baseline log-odds
    contributions: List[FeatureContribution]
    narrative: str       # plain-English explanation
