"""Rolling p50/p95/p99 latency tracker for the scorer."""
from __future__ import annotations

import threading
from collections import deque
from typing import Deque


class PerfTracker:
    def __init__(self, window: int = 1000) -> None:
        self._lock = threading.RLock()
        self._latencies: Deque[float] = deque(maxlen=window)

    def record(self, latency_ms: float) -> None:
        with self._lock:
            self._latencies.append(latency_ms)

    def stats(self) -> dict:
        with self._lock:
            samples = sorted(self._latencies)
        n = len(samples)
        if n == 0:
            return {"samples": 0, "p50_ms": 0, "p95_ms": 0, "p99_ms": 0, "avg_ms": 0, "max_ms": 0}
        def pct(p: float) -> float:
            idx = min(n - 1, int(round(p * (n - 1))))
            return round(samples[idx], 3)
        avg = round(sum(samples) / n, 3)
        return {
            "samples": n,
            "p50_ms": pct(0.50),
            "p95_ms": pct(0.95),
            "p99_ms": pct(0.99),
            "avg_ms": avg,
            "max_ms": round(samples[-1], 3),
        }


PERF = PerfTracker()
