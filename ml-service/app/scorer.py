"""In-process model holder with thread-safe hot-swap."""
from __future__ import annotations

import logging
import shutil
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import xgboost as xgb

from .config import FEATURE_NAMES, SETTINGS

log = logging.getLogger(__name__)


@dataclass
class Prediction:
    score: float
    model_version: str
    latency_ms: float


class ModelStore:
    """Holds the active XGBoost Booster, allows atomic hot-swap."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._booster: xgb.Booster | None = None
        self._version: str = "uninitialized"

    @property
    def version(self) -> str:
        return self._version

    def is_ready(self) -> bool:
        return self._booster is not None

    def load(self, path: Path, version: str) -> None:
        booster = xgb.Booster()
        booster.load_model(str(path))
        with self._lock:
            self._booster = booster
            self._version = version
        log.info("model loaded: version=%s path=%s", version, path)

    def hot_swap_from_candidate(self, version: str) -> None:
        """Promote candidate.bin → model.bin and reload atomically."""
        candidate = SETTINGS.candidate_path
        active = SETTINGS.model_path
        if not candidate.exists():
            raise FileNotFoundError(f"no candidate at {candidate}")
        # promote on disk
        shutil.copy2(candidate, active)
        # then reload in process
        new_booster = xgb.Booster()
        new_booster.load_model(str(active))
        with self._lock:
            self._booster = new_booster
            self._version = version
        log.info("hot-swap complete: now serving version=%s", version)

    def predict(self, features: Iterable[float]) -> Prediction:
        with self._lock:
            booster = self._booster
            version = self._version
        if booster is None:
            raise RuntimeError("model not loaded")

        arr = np.asarray(list(features), dtype=float).reshape(1, -1)
        dmat = xgb.DMatrix(arr, feature_names=list(FEATURE_NAMES))
        t0 = time.perf_counter()
        score = float(booster.predict(dmat)[0])
        elapsed = (time.perf_counter() - t0) * 1000.0
        return Prediction(score=score, model_version=version, latency_ms=elapsed)


# module-level singleton
MODEL = ModelStore()
