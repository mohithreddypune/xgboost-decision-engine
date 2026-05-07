# Architecture deep-dive

## Why this shape

The design separates three concerns that change at very different rates:

1. **The decision policy** (Spring Boot) — changes whenever the business adjusts what to do with a score (block / step-up / approve). Java + Spring is the right home for this because it lives next to the audit trail and the action effects.
2. **The model** (FastAPI + XGBoost) — changes whenever the model is retrained. Putting this in its own Python service means the data team owns the deployable surface for the model, and retrains never block API traffic on the orchestrator.
3. **The transport** (Kafka) — buffers bursts, gives at-least-once semantics, and lets the simulator (or any upstream system) produce without coupling to the orchestrator's deployment cycle.

## Critical paths

### Hot inference path (~10 ms target)
`Kafka → @KafkaListener → ScoringClient (HTTP) → FastAPI /score → in-process XGBoost → response → DecisionRouter → AuditService.persist → DecisionBroadcaster → STOMP /topic/decisions → Angular`

The only blocking I/O on this path is the HTTP call to `ml-service` and the JDBC insert. Both run on Kafka's listener thread per partition. To scale beyond a single broker, we partition `transactions` by `transaction_id` and run multiple orchestrator replicas in the same consumer group.

### Drift / retrain path (background)
`APScheduler tick → DriftMonitor.compute() → if PSI ≥ threshold → trainer.train() → candidate.bin → ModelStore.hot_swap_from_candidate() → /score now serves the new version`

There is no service restart, no Kafka rewind, and no in-flight request is dropped. The mutex around `ModelStore._booster` is held for microseconds — only long enough to rebind the reference.

## Failure modes & fallbacks

| Failure                       | Behavior                                                                  |
|-------------------------------|---------------------------------------------------------------------------|
| `ml-service` is down          | `ScoringClient` returns a neutral 0.5 score with `model_version=fallback`. Orchestrator continues to consume Kafka and audit decisions; engineers can grep for `model_version=fallback` to find degraded-mode traffic. |
| Postgres is down              | Hibernate retries on the next message; Kafka offset is not committed, so the message is reprocessed. |
| Kafka is down                 | Orchestrator's listener container reconnects automatically. |
| Retrain produces a worse model | `val_auc` is logged; in production you would gate the hot-swap on `val_auc >= previous_auc - epsilon`. (Hook is in `retrain.py` — easy extension.) |

## Observability

- Spring Boot Actuator at `/actuator/health` and `/actuator/metrics`.
- Every prediction is durable in Postgres with score, action, latency, and model version — that *is* the audit log.
- The dashboard's drift chart is the live observability surface for the model.

## Extending

- **More features**: add to `FEATURE_NAMES` in `ml-service/app/config.py`, regenerate training data, retrain. The orchestrator's `Transaction` record needs the matching field too.
- **Different action policy**: edit `decision-engine.thresholds.*` in `application.yml`. No code change.
- **Real downstream effects**: replace the `AuditService`-only path inside `TransactionConsumer` with a per-action handler chain (e.g., publish to a `blocked-transactions` Kafka topic when `Action.BLOCK`).
