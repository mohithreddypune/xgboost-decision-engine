# Infra notes

The whole system is described by `../docker-compose.yml` at the repo root.

## Topics

Kafka topics are auto-created on first publish. The system uses one:

| Topic         | Producer            | Consumer                                  |
|---------------|---------------------|-------------------------------------------|
| `transactions`| `simulator`         | `orchestrator` (Spring Boot @KafkaListener) |

## Health checks

| Service      | URL                                           |
|--------------|-----------------------------------------------|
| ml-service   | `curl http://localhost:8000/health`           |
| orchestrator | `curl http://localhost:8080/actuator/health`  |
| dashboard    | `curl http://localhost:4200/`                 |
| postgres     | `pg_isready -h localhost -U decisions`        |

## Re-creating the dataset / model

```
docker compose exec ml-service rm -f /app/models/model.bin
docker compose restart ml-service
```

The service will re-train on its next boot.
