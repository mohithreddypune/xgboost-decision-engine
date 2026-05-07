"""FastAPI entry point for the XGBoost scoring service."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException

from .config import FEATURE_NAMES, SETTINGS
from .drift import MONITOR
from .retrain import start_scheduler, trigger_retrain, last_result
from .scorer import MODEL
from .schemas import (
    DriftResponse,
    HealthResponse,
    RetrainResponse,
    ScoreRequest,
    ScoreResponse,
)
from .trainer import train

log = logging.getLogger("ml-service")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


def _bootstrap_model() -> None:
    """Train + load if no active model is on disk yet."""
    if not SETTINGS.model_path.exists():
        log.info("no model at %s — running cold-start training", SETTINGS.model_path)
        metrics = train()
        # promote candidate to active
        SETTINGS.candidate_path.replace(SETTINGS.model_path)
        version = metrics["version"]
    else:
        version = "preloaded-" + time.strftime("%Y%m%d-%H%M%S")
    MODEL.load(SETTINGS.model_path, version=version)
    MONITOR.load_reference()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_model()
    scheduler = start_scheduler()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="XGBoost Decision Engine — Scoring Service",
    version="0.1.0",
    description="Sub-10 ms fraud scoring with PSI drift detection and zero-downtime retraining.",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if MODEL.is_ready() else "warming",
        model_version=MODEL.version,
        drift_reference_loaded=MONITOR.reference_loaded(),
    )


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    if not MODEL.is_ready():
        raise HTTPException(status_code=503, detail="model not ready")

    feature_vec = [
        req.amount,
        req.merchant_category,
        req.hour_of_day,
        req.is_weekend,
        req.txn_count_1h,
        req.amount_zscore_user,
        req.device_risk_score,
        req.geo_distance_km,
    ]
    pred = MODEL.predict(feature_vec)
    MONITOR.observe(feature_vec)
    return ScoreResponse(
        transaction_id=req.transaction_id,
        score=pred.score,
        model_version=pred.model_version,
        latency_ms=round(pred.latency_ms, 3),
    )


@app.get("/drift", response_model=DriftResponse)
def drift() -> DriftResponse:
    report = MONITOR.compute()
    return DriftResponse(
        max_psi=report["max_psi"],
        per_feature=report["per_feature"],
        samples=report["samples"],
        drifted=report["drifted"],
        threshold=SETTINGS.drift_psi_threshold,
    )


@app.post("/retrain", response_model=RetrainResponse)
def retrain(background: BackgroundTasks) -> RetrainResponse:
    """Manually trigger retraining (drift scheduler also calls this internally)."""
    result = trigger_retrain(reason="manual")
    return RetrainResponse(**{k: v for k, v in result.items() if k in RetrainResponse.model_fields})


@app.get("/last-retrain", response_model=RetrainResponse)
def last_retrain() -> RetrainResponse:
    result = last_result() or {"status": "never"}
    return RetrainResponse(**{k: v for k, v in result.items() if k in RetrainResponse.model_fields})


@app.get("/features")
def features() -> dict:
    return {"features": list(FEATURE_NAMES)}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="info")
