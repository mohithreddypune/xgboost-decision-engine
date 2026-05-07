# XGBoost Autonomous Decision Engine

> A production-grade event-driven ML system that **scores transactions, makes decisions, and acts on them automatically** — with model drift detection and zero-downtime auto-retraining.

[![Java](https://img.shields.io/badge/Java-17-orange)]()
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen)]()
[![Python](https://img.shields.io/badge/Python-3.11-blue)]()
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0-red)]()
[![Angular](https://img.shields.io/badge/Angular-17-dd0031)]()
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-3.6-black)]()
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791)]()
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed)]()

---

## What this is

This is **not** a Jupyter notebook. It is a running, multi-service system that ingests events from Kafka, scores them with an XGBoost model in sub-10 ms, **routes the decision to a downstream action** (block / flag / approve), persists the decision for audit, and streams everything to a live Angular dashboard. The model retrains itself when drift is detected and **hot-swaps** without bringing the service down.

The reference use case is **real-time fraud / transaction-risk scoring** — the same pattern Morgan Stanley, Brex, Stripe Radar, and Citadel use in production for risk and surveillance.

## Architecture

```
                       ┌──────────────────────────┐
                       │  Transaction Simulator   │  (synthetic events)
                       └────────────┬─────────────┘
                                    │ produce
                                    ▼
                       ┌──────────────────────────┐
                       │     Apache Kafka         │  topic: transactions
                       └────────────┬─────────────┘
                                    │ consume
                                    ▼
   ┌────────────────────────────────────────────────────────────┐
   │             Spring Boot Orchestrator (Java 17)             │
   │  • KafkaListener  • ScoringClient → FastAPI                │
   │  • DecisionRouter (block / flag / approve)                 │
   │  • AuditService → Postgres   • WebSocket → Dashboard       │
   └─────────┬────────────────────────────┬─────────────────────┘
             │ HTTP /score                │ INSERT decisions
             ▼                            ▼
   ┌──────────────────────┐     ┌──────────────────────┐
   │  FastAPI ML Service  │     │     PostgreSQL       │
   │  (Python 3.11)       │     │  decisions, audit,   │
   │  • XGBoost in-memory │     │  model_versions      │
   │  • <10ms inference   │     └──────────────────────┘
   │  • Drift detector    │
   │  • Auto-retrainer    │
   │  • Hot model swap    │
   └──────────────────────┘
                                    ▲
                                    │ WebSocket /ws/decisions
                       ┌────────────┴─────────────┐
                       │   Angular 17 Dashboard   │
                       │  Live feed • Drift chart │
                       │  Accuracy • Audit log    │
                       └──────────────────────────┘
```

## System modules

| # | Module                    | Stack                          | Responsibility                                                |
|---|---------------------------|--------------------------------|----------------------------------------------------------------|
| 1 | `ml-service/`             | Python 3.11 · FastAPI · XGBoost · scikit-learn | Train, serve, monitor drift, auto-retrain, hot-swap model |
| 2 | `orchestrator/`           | Java 17 · Spring Boot 3.2 · Kafka · JPA · WebSocket | Consume events, score, route action, audit, broadcast |
| 3 | `dashboard/`              | Angular 17 · TypeScript · Chart.js · WebSocket | Live decision feed, drift chart, audit table |
| 4 | `db/`                     | PostgreSQL 16                  | Persistent decision store + model version registry             |
| 5 | `simulator/`              | Python                         | Synthetic transaction producer (fraud + legit mix)             |
| 6 | `infra/` + `docker-compose.yml` | Docker Compose         | One-command boot of the whole system                           |

## Quick start

### Prerequisites
Docker Desktop. That's it.

```bash
# 1. Boot the whole system
docker compose up --build

# 2. Watch the dashboard
open http://localhost:4200

# 3. (Optional) Hammer it with synthetic traffic
docker compose run --rm simulator
```

In about 60 seconds you'll see decisions streaming through the Angular dashboard, with the drift chart updating live and decisions persisted in Postgres.

### Service endpoints

| Service           | URL                                | Notes                                    |
|-------------------|------------------------------------|------------------------------------------|
| Angular dashboard | http://localhost:4200              | Live UI                                  |
| Spring Boot API   | http://localhost:8080              | `/api/decisions`, `/ws/decisions`        |
| FastAPI ML        | http://localhost:8000              | `/score`, `/retrain`, `/health`, `/docs` |
| Postgres          | localhost:5432 (`decisions` db)    | user `decisions` / pass `decisions`      |
| Kafka             | localhost:9092                     | topic `transactions`                     |

## How it actually works

### 1. Sub-10 ms inference
The XGBoost model is trained once on startup, dumped to `models/model.bin`, and loaded into the FastAPI process **once at boot**. Every `/score` call runs against the in-process Booster — no I/O, no network, no warm-up. P99 latency on a laptop sits under 8 ms for a single event.

### 2. Drift detection
Every 5 minutes, the ML service computes a population-stability-index (PSI) between the recent live feature distribution and the training distribution. When PSI for any feature exceeds **0.25**, the drift flag flips and the auto-retrainer triggers.

### 3. Zero-downtime hot-swap
Retraining writes to `models/candidate.bin`. The serving process atomically swaps the model reference inside a single mutex — no restart, no Kafka rewind, no dropped events. Old in-flight requests finish on the previous booster.

### 4. Decision routing
Spring Boot's `DecisionRouter` maps the score to an action via a configurable threshold table:

| Score range | Action       | Downstream effect                  |
|-------------|--------------|------------------------------------|
| ≥ 0.90      | `BLOCK`      | Reject the transaction             |
| 0.60 – 0.90 | `FLAG`       | Send to manual-review queue        |
| 0.20 – 0.60 | `STEP_UP`    | Trigger 2FA / extra verification   |
| < 0.20      | `APPROVE`    | Pass through                       |

Every action is persisted to Postgres with the score, model version, and feature payload — fully auditable for compliance.

### 5. WebSocket fan-out
Spring's `SimpMessagingTemplate` pushes every decision to subscribers on `/topic/decisions`. The Angular dashboard subscribes via STOMP-over-WebSocket and renders the feed in real time.

## Repository layout

```
.
├── ml-service/          # FastAPI + XGBoost
│   ├── app/             # main, scorer, drift, retrain
│   ├── models/          # serialized boosters
│   ├── data/            # synthetic training set
│   └── Dockerfile
├── orchestrator/        # Spring Boot
│   ├── src/main/java/com/decisionengine/
│   │   ├── kafka/       # consumer
│   │   ├── scoring/     # FastAPI client
│   │   ├── routing/     # decision policy
│   │   ├── audit/       # Postgres writer
│   │   └── websocket/   # live feed
│   ├── pom.xml
│   └── Dockerfile
├── dashboard/           # Angular 17
│   ├── src/app/         # components + services
│   ├── package.json
│   └── Dockerfile
├── simulator/           # synthetic event producer
├── db/migrations/       # schema
├── infra/               # extra compose helpers
└── docker-compose.yml
```

## Resume bullets (drop-in)

> Built an event-driven autonomous ML system using **Spring Boot, Kafka, FastAPI, XGBoost, Angular 17, and Postgres** that scores live transactions in **<10 ms** and routes decisions (block / flag / step-up / approve) without human intervention.

> Implemented **PSI-based drift detection** with an auto-retraining job and **zero-downtime model hot-swap**, eliminating the redeploy cycle for model refreshes.

> Designed an **end-to-end audit trail** of every prediction (features, score, model version, action) in Postgres for regulatory explainability.

> Real-time Angular 17 dashboard streams decisions via **STOMP-over-WebSocket**, rendering live drift, accuracy, and action-volume charts.

## License

MIT — use, fork, ship.
