"""FastAPI entry point for the XGBoost scoring service."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import BackgroundTasks, FastAPI, HTTPException

from .config import FEATURE_NAMES, SETTINGS
from .drift import MONITOR
from .perf import PERF
from .retrain import start_scheduler, trigger_retrain, last_result
from .scorer import MODEL
from .schemas import (
    BatchScoreRequest,
    BatchScoreResponse,
    DriftResponse,
    ExplainResponse,
    FeatureContribution,
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
    PERF.record(pred.latency_ms)
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


@app.get("/drift/history")
def drift_history() -> dict:
    """24h ring buffer of drift snapshots (sampled every 5 minutes)."""
    return {"threshold": SETTINGS.drift_psi_threshold, "points": MONITOR.history()}


@app.get("/perf")
def perf_stats() -> dict:
    """Rolling p50/p95/p99 latency over the last 1000 inferences."""
    return PERF.stats()


@app.post("/score-batch", response_model=BatchScoreResponse)
def score_batch(req: BatchScoreRequest) -> BatchScoreResponse:
    """Score many transactions in a single request — used by the document analyzer."""
    if not MODEL.is_ready():
        raise HTTPException(status_code=503, detail="model not ready")
    if not req.transactions:
        return BatchScoreResponse(
            model_version=MODEL.version, count=0, latency_ms=0.0, scores=[]
        )

    rows = [
        [
            t.amount,
            t.merchant_category,
            t.hour_of_day,
            t.is_weekend,
            t.txn_count_1h,
            t.amount_zscore_user,
            t.device_risk_score,
            t.geo_distance_km,
        ]
        for t in req.transactions
    ]
    scores, version, latency = MODEL.predict_batch(rows)
    # observe each row for drift
    for r in rows:
        MONITOR.observe(r)

    return BatchScoreResponse(
        model_version=version,
        count=len(scores),
        latency_ms=round(latency, 3),
        scores=[
            ScoreResponse(
                transaction_id=req.transactions[i].transaction_id,
                score=scores[i],
                model_version=version,
                latency_ms=round(latency / max(len(scores), 1), 3),
            )
            for i in range(len(scores))
        ],
    )


def _build_narrative(score: float, contribs: list[FeatureContribution]) -> str:
    """Plain-English explanation suitable for analysts and regulators."""
    pos = sorted([c for c in contribs if c.contribution > 0],
                 key=lambda c: -c.contribution)[:3]
    neg = sorted([c for c in contribs if c.contribution < 0],
                 key=lambda c: c.contribution)[:2]

    if score >= 0.90:
        verdict = "blocked as fraud"
    elif score >= 0.60:
        verdict = "flagged for review"
    elif score >= 0.20:
        verdict = "sent for step-up verification"
    else:
        verdict = "approved as low-risk"

    parts = [f"This transaction was {verdict} (score {score:.3f})."]
    if pos:
        reasons = ", ".join([
            f"{c.feature}={c.value:.3g} (contribution +{c.contribution:.3f})"
            for c in pos
        ])
        parts.append(f"The strongest fraud signals were: {reasons}.")
    if neg and score < 0.5:
        reasons = ", ".join([
            f"{c.feature}={c.value:.3g}" for c in neg
        ])
        parts.append(f"Mitigating signals: {reasons}.")
    return " ".join(parts)


@app.post("/explain", response_model=ExplainResponse)
def explain(req: ScoreRequest) -> ExplainResponse:
    """SHAP-style per-feature contributions for a single transaction."""
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
    result = MODEL.explain(feature_vec)
    contribs = [
        FeatureContribution(
            feature=name,
            value=float(result["feature_values"][i]),
            contribution=float(result["contributions"][i]),
            direction="fraud" if result["contributions"][i] > 0 else "clean",
        )
        for i, name in enumerate(FEATURE_NAMES)
    ]
    narrative = _build_narrative(result["score"], contribs)

    return ExplainResponse(
        transaction_id=req.transaction_id,
        score=result["score"],
        model_version=result["version"],
        base_value=result["bias"],
        contributions=contribs,
        narrative=narrative,
    )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="info")
