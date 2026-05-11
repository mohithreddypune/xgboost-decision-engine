"""Synthetic transaction event producer.

Mixes a normal-traffic distribution with periodic fraud-heavy bursts so the
dashboard shows visible variation in the action mix and the drift detector has
a chance to fire over time.
"""
from __future__ import annotations

import json
import os
import time
import uuid

import numpy as np
from kafka import KafkaProducer


BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
TOPIC = os.getenv("KAFKA_TOPIC", "transactions")
RATE = float(os.getenv("EVENTS_PER_SECOND", "5"))


def _connect() -> KafkaProducer:
    for attempt in range(30):
        try:
            return KafkaProducer(
                bootstrap_servers=BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                linger_ms=50,
                acks=1,
            )
        except Exception as e:
            print(f"kafka not ready (attempt {attempt + 1}/30): {e}")
            time.sleep(2)
    raise RuntimeError("Could not connect to Kafka")


# Major-city centroids — fraudulent events skew toward edge-cities, clean toward majors
_CLEAN_CITIES = [
    ("New York", 40.7128, -74.0060), ("London", 51.5074, -0.1278),
    ("Tokyo", 35.6762, 139.6503), ("Singapore", 1.3521, 103.8198),
    ("Sydney", -33.8688, 151.2093), ("San Francisco", 37.7749, -122.4194),
    ("Toronto", 43.6532, -79.3832), ("Berlin", 52.5200, 13.4050),
    ("Mumbai", 19.0760, 72.8777), ("São Paulo", -23.5505, -46.6333),
]
_FRAUD_CITIES = [
    ("Lagos", 6.5244, 3.3792), ("Caracas", 10.4806, -66.9036),
    ("Kyiv", 50.4501, 30.5234), ("Tehran", 35.6892, 51.3890),
    ("Manila", 14.5995, 120.9842),
]


def _make_event(rng: np.random.Generator, fraud_bias: float) -> dict:
    """`fraud_bias` in [0, 1] increases the chance of fraud-like features."""
    fraud_signal = rng.uniform() < fraud_bias
    if fraud_signal:
        amount = float(rng.lognormal(mean=5.5, sigma=1.0))
        device_risk = float(rng.beta(7, 2))
        zscore = float(rng.normal(2.5, 1.0))
        txn_count = int(rng.poisson(5))
        hour = int(rng.choice([1, 2, 3, 23, 0]))
        geo = float(rng.exponential(50))
        merchant = int(rng.choice([13, 7, 13, 13, 4]))
        city = _FRAUD_CITIES[int(rng.integers(0, len(_FRAUD_CITIES)))]
    else:
        amount = float(rng.lognormal(mean=3.2, sigma=1.0))
        device_risk = float(rng.beta(2, 8))
        zscore = float(rng.normal(0.0, 1.0))
        txn_count = int(rng.poisson(1.2))
        hour = int(rng.integers(8, 22))
        geo = float(rng.exponential(8))
        merchant = int(rng.integers(0, 20))
        city = _CLEAN_CITIES[int(rng.integers(0, len(_CLEAN_CITIES)))]

    # Add small jitter to city center so map pins don't all stack
    lat = round(city[1] + float(rng.normal(0, 0.4)), 4)
    lon = round(city[2] + float(rng.normal(0, 0.4)), 4)

    return {
        "transaction_id": uuid.uuid4().hex[:16],
        "amount": round(amount, 2),
        "merchant_category": merchant,
        "hour_of_day": hour,
        "is_weekend": int(rng.integers(0, 2)),
        "txn_count_1h": txn_count,
        "amount_zscore_user": round(zscore, 4),
        "device_risk_score": round(device_risk, 4),
        "geo_distance_km": round(geo, 2),
        "lat": lat,
        "lon": lon,
        "city": city[0],
    }


def main() -> None:
    rng = np.random.default_rng()
    producer = _connect()
    print(f"Producing to {BOOTSTRAP} topic={TOPIC} at {RATE} eps")

    interval = 1.0 / max(RATE, 0.1)
    t0 = time.time()
    sent = 0
    while True:
        # 7% baseline fraud rate + occasional 30s "attack waves" that push it to 25%
        elapsed = time.time() - t0
        in_attack_wave = (int(elapsed) % 180) < 30
        fraud_bias = 0.25 if in_attack_wave else 0.07

        evt = _make_event(rng, fraud_bias)
        producer.send(TOPIC, evt)
        sent += 1
        if sent % 50 == 0:
            print(f"sent={sent} attack_wave={in_attack_wave}")
        time.sleep(interval)


if __name__ == "__main__":
    main()
