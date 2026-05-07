"""Smoke tests for the ML service (no FastAPI client required)."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


def test_data_generator_shape():
    from app.data_gen import generate

    df = generate(n_rows=2_000, seed=1)
    assert len(df) == 2_000
    assert df["is_fraud"].between(0, 1).all()
    # Non-trivial fraud rate
    assert 0.005 < df["is_fraud"].mean() < 0.20


def test_train_and_predict(tmp_path: Path, monkeypatch):
    # redirect MODEL_DIR / DATA_DIR before importing any module-level singletons
    monkeypatch.setenv("MODEL_DIR", str(tmp_path / "models"))
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))

    # reload settings so paths point to tmp
    import importlib
    from app import config

    importlib.reload(config)
    from app import trainer, scorer  # noqa: WPS433

    importlib.reload(trainer)
    importlib.reload(scorer)

    metrics = trainer.train()
    assert metrics["val_auc"] >= 0.85
    assert Path(metrics["candidate_path"]).exists()

    # promote and serve
    Path(metrics["candidate_path"]).replace(config.SETTINGS.model_path)
    scorer.MODEL.load(config.SETTINGS.model_path, version=metrics["version"])

    pred = scorer.MODEL.predict([100.0, 5, 14, 0, 1, 0.0, 0.1, 2.0])
    assert 0.0 <= pred.score <= 1.0
    assert pred.latency_ms < 100.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
