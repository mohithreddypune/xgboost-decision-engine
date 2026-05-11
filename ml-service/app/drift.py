"""PSI-based drift detection over the live feature stream.

Population Stability Index (PSI) compares the binned distribution of recent live
features against the binned distribution of the training set. PSI > 0.25 is the
common industry threshold for "significant drift requiring retraining."
"""
from __future__ import annotations

import json
import logging
import math
import threading
import time
from collections import deque
from pathlib import Path
from typing import Deque, Iterable

import numpy as np

from .config import FEATURE_NAMES, SETTINGS

log = logging.getLogger(__name__)


def _psi(expected_pcts: np.ndarray, actual_pcts: np.ndarray) -> float:
    eps = 1e-6
    expected_pcts = np.clip(expected_pcts, eps, None)
    actual_pcts = np.clip(actual_pcts, eps, None)
    return float(np.sum((actual_pcts - expected_pcts) * np.log(actual_pcts / expected_pcts)))


def _bin_counts(values: Iterable[float], edges: list[float]) -> np.ndarray:
    arr = np.asarray(list(values), dtype=float)
    if arr.size == 0:
        return np.zeros(len(edges) - 1)
    counts, _ = np.histogram(arr, bins=edges)
    total = counts.sum()
    if total == 0:
        return np.zeros_like(counts, dtype=float)
    return counts.astype(float) / total


class DriftMonitor:
    """Maintains a sliding window of recent feature vectors and computes PSI."""

    def __init__(self, window_size: int = 5000) -> None:
        self._lock = threading.RLock()
        self._window: Deque[list[float]] = deque(maxlen=window_size)
        self._reference: dict | None = None
        # 24h rolling history of (timestamp, max_psi, per_feature) — sampled every 5min
        self._history: Deque[dict] = deque(maxlen=288)  # 288 = 5min * 288 = 24h
        self._last_history_ts: float = 0.0

    def reference_loaded(self) -> bool:
        return self._reference is not None

    def load_reference(self, path: Path | None = None) -> None:
        ref_path = path or SETTINGS.reference_stats_path
        if not ref_path.exists():
            log.warning("no reference stats at %s — drift detection disabled", ref_path)
            return
        self._reference = json.loads(ref_path.read_text())
        log.info("drift reference loaded for %d features", len(self._reference))

    def observe(self, features: Iterable[float]) -> None:
        with self._lock:
            self._window.append(list(features))

    def compute(self) -> dict:
        """Return per-feature PSI and the max."""
        if self._reference is None:
            return {"max_psi": 0.0, "per_feature": {}, "samples": 0, "drifted": False}

        with self._lock:
            snapshot = list(self._window)

        if len(snapshot) < 200:
            return {
                "max_psi": 0.0,
                "per_feature": {},
                "samples": len(snapshot),
                "drifted": False,
            }

        arr = np.asarray(snapshot, dtype=float)
        per_feature: dict[str, float] = {}
        for idx, name in enumerate(FEATURE_NAMES):
            ref = self._reference.get(name)
            if not ref:
                continue
            edges = ref["edges"]
            # rebuild expected bin distribution: by construction (deciles) ~ 0.1 each
            expected = np.full(len(edges) - 1, 1.0 / (len(edges) - 1))
            actual = _bin_counts(arr[:, idx], edges)
            per_feature[name] = round(_psi(expected, actual), 4)

        max_psi = max(per_feature.values()) if per_feature else 0.0
        result = {
            "max_psi": round(max_psi, 4),
            "per_feature": per_feature,
            "samples": len(snapshot),
            "drifted": max_psi >= SETTINGS.drift_psi_threshold,
        }
        self._record_history(result)
        return result

    def _record_history(self, current: dict) -> None:
        now = time.time()
        # Sample every 5 minutes to fill the 24h ring buffer
        if now - self._last_history_ts < 300:
            return
        with self._lock:
            self._last_history_ts = now
            self._history.append({
                "ts": int(now * 1000),
                "max_psi": current["max_psi"],
                "per_feature": current["per_feature"],
            })

    def history(self) -> list[dict]:
        with self._lock:
            return list(self._history)


MONITOR = DriftMonitor()
