"""Synthetic fraud-transaction dataset generator.

Produces a labeled dataset where ~10-12% of rows are fraud. Features are designed
to have realistic, learnable signal — the XGBoost model converges to a healthy
ROC-AUC (~0.85) which is in the realistic range for production fraud models.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import FEATURE_NAMES


def generate(n_rows: int = 50_000, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # base population
    amount = rng.lognormal(mean=3.2, sigma=1.0, size=n_rows)
    merchant_category = rng.integers(low=0, high=20, size=n_rows)
    hour_of_day = rng.integers(low=0, high=24, size=n_rows)
    is_weekend = rng.integers(low=0, high=2, size=n_rows)
    txn_count_1h = rng.poisson(lam=1.2, size=n_rows)
    amount_zscore_user = rng.normal(loc=0.0, scale=1.0, size=n_rows)
    device_risk_score = rng.beta(a=2.0, b=8.0, size=n_rows)
    geo_distance_km = rng.exponential(scale=10.0, size=n_rows)

    # latent fraud signal (strong, learnable, with realistic interaction effects)
    logit = (
        -5.5
        + 0.0015 * amount
        + 1.4 * (hour_of_day >= 22).astype(float)
        + 0.9 * (hour_of_day <= 4).astype(float)
        + 0.7 * (txn_count_1h >= 4).astype(float)
        + 1.8 * np.clip(amount_zscore_user, 0, None)
        + 5.0 * device_risk_score
        + 0.05 * geo_distance_km
        + 1.2 * (merchant_category == 13).astype(float)  # "risky" category
        + 1.0 * np.clip(amount_zscore_user, 0, None) * device_risk_score  # interaction
    )
    prob = 1.0 / (1.0 + np.exp(-logit))
    is_fraud = (rng.uniform(size=n_rows) < prob).astype(int)

    df = pd.DataFrame(
        {
            "amount": amount,
            "merchant_category": merchant_category,
            "hour_of_day": hour_of_day,
            "is_weekend": is_weekend,
            "txn_count_1h": txn_count_1h,
            "amount_zscore_user": amount_zscore_user,
            "device_risk_score": device_risk_score,
            "geo_distance_km": geo_distance_km,
            "is_fraud": is_fraud,
        }
    )
    # ensure column order matches FEATURE_NAMES
    df = df[list(FEATURE_NAMES) + ["is_fraud"]]
    return df


if __name__ == "__main__":
    out = generate()
    out.to_csv("transactions_train.csv", index=False)
    print(f"Wrote {len(out):,} rows. Fraud rate: {out['is_fraud'].mean():.3%}")
