"""Training pipeline for the fraud XGBoost model.

Used both for the initial cold-start training and for periodic retraining
triggered by the drift detector.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

from . import data_gen
from .config import FEATURE_NAMES, SETTINGS

log = logging.getLogger(__name__)


def _ensure_training_data(path: Path) -> pd.DataFrame:
    if path.exists():
        return pd.read_csv(path)
    log.info("training data not found at %s — generating synthetic set", path)
    df = data_gen.generate()
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return df


def _reference_stats(df: pd.DataFrame, features: Iterable[str]) -> dict:
    """Per-feature percentile bins used by the PSI drift detector."""
    stats = {}
    for f in features:
        series = df[f].astype(float)
        # 10 quantile-based bin edges (deciles)
        edges = np.quantile(series, np.linspace(0, 1, 11)).tolist()
        # widen first/last to catch outliers
        edges[0] = -np.inf
        edges[-1] = np.inf
        stats[f] = {"edges": edges, "mean": float(series.mean()), "std": float(series.std())}
    return stats


def train(version_tag: str | None = None) -> dict:
    """Train a booster, persist to candidate.bin, return metrics + version."""
    SETTINGS.model_dir.mkdir(parents=True, exist_ok=True)
    SETTINGS.data_dir.mkdir(parents=True, exist_ok=True)

    df = _ensure_training_data(SETTINGS.training_data_path)
    X = df[list(FEATURE_NAMES)]
    y = df["is_fraud"]

    X_tr, X_va, y_tr, y_va = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    dtrain = xgb.DMatrix(X_tr, label=y_tr, feature_names=list(FEATURE_NAMES))
    dval = xgb.DMatrix(X_va, label=y_va, feature_names=list(FEATURE_NAMES))

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "max_depth": 6,
        "eta": 0.08,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "min_child_weight": 4,
        "tree_method": "hist",
    }

    t0 = time.time()
    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=600,
        evals=[(dval, "val")],
        early_stopping_rounds=40,
        verbose_eval=False,
    )
    train_secs = time.time() - t0

    val_pred = booster.predict(dval)
    auc = float(roc_auc_score(y_va, val_pred))

    candidate_path = SETTINGS.candidate_path
    booster.save_model(str(candidate_path))

    # reference distribution for drift detection
    stats = _reference_stats(X_tr, FEATURE_NAMES)
    SETTINGS.reference_stats_path.write_text(json.dumps(stats))

    version = version_tag or time.strftime("%Y%m%d-%H%M%S")
    metrics = {
        "version": version,
        "rows": int(len(df)),
        "train_seconds": round(train_secs, 2),
        "val_auc": round(auc, 4),
        "fraud_rate": round(float(y.mean()), 4),
        "candidate_path": str(candidate_path),
    }
    log.info("trained model: %s", metrics)
    return metrics


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(train())
