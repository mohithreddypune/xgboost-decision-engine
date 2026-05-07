"""Background retraining job triggered when drift is detected."""
from __future__ import annotations

import logging
import threading
import time

from apscheduler.schedulers.background import BackgroundScheduler

from .config import SETTINGS
from .drift import MONITOR
from .scorer import MODEL
from .trainer import train

log = logging.getLogger(__name__)

_LAST_RETRAIN_TS: float = 0.0
_RETRAIN_LOCK = threading.Lock()
_LAST_RESULT: dict | None = None
_MIN_RETRAIN_INTERVAL_SECONDS = 600  # cool-down


def trigger_retrain(reason: str) -> dict:
    global _LAST_RETRAIN_TS, _LAST_RESULT
    with _RETRAIN_LOCK:
        now = time.time()
        if now - _LAST_RETRAIN_TS < _MIN_RETRAIN_INTERVAL_SECONDS:
            log.info("retrain skipped (cool-down): reason=%s", reason)
            return {"status": "skipped", "reason": "cool-down"}

        log.info("retraining triggered: reason=%s", reason)
        metrics = train()
        MODEL.hot_swap_from_candidate(version=metrics["version"])
        MONITOR.load_reference()
        _LAST_RETRAIN_TS = now
        _LAST_RESULT = {"status": "ok", "reason": reason, **metrics}
        return _LAST_RESULT


def last_result() -> dict | None:
    return _LAST_RESULT


def _drift_check_job() -> None:
    report = MONITOR.compute()
    if report.get("drifted"):
        log.warning("drift detected: %s", report)
        try:
            trigger_retrain(reason=f"drift max_psi={report['max_psi']}")
        except Exception:
            log.exception("retrain failed")


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        _drift_check_job,
        "interval",
        seconds=SETTINGS.drift_check_interval_seconds,
        id="drift-check",
        next_run_time=None,
    )
    scheduler.start()
    log.info(
        "drift scheduler started (interval=%ds, threshold=%.2f)",
        SETTINGS.drift_check_interval_seconds,
        SETTINGS.drift_psi_threshold,
    )
    return scheduler
