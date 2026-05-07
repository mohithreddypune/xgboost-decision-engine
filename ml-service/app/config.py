"""Runtime configuration for the ML service."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    model_dir: Path
    data_dir: Path
    drift_psi_threshold: float
    drift_check_interval_seconds: int
    feature_names: tuple[str, ...]

    @property
    def model_path(self) -> Path:
        return self.model_dir / "model.bin"

    @property
    def candidate_path(self) -> Path:
        return self.model_dir / "candidate.bin"

    @property
    def training_data_path(self) -> Path:
        return self.data_dir / "transactions_train.csv"

    @property
    def reference_stats_path(self) -> Path:
        return self.model_dir / "reference_stats.json"


FEATURE_NAMES: tuple[str, ...] = (
    "amount",
    "merchant_category",
    "hour_of_day",
    "is_weekend",
    "txn_count_1h",
    "amount_zscore_user",
    "device_risk_score",
    "geo_distance_km",
)


def load_settings() -> Settings:
    return Settings(
        model_dir=Path(os.getenv("MODEL_DIR", "./models")),
        data_dir=Path(os.getenv("DATA_DIR", "./data")),
        drift_psi_threshold=float(os.getenv("DRIFT_PSI_THRESHOLD", "0.25")),
        drift_check_interval_seconds=int(
            os.getenv("DRIFT_CHECK_INTERVAL_SECONDS", "300")
        ),
        feature_names=FEATURE_NAMES,
    )


SETTINGS = load_settings()
