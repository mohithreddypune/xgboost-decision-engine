-- ----------------------------------------------------------------------------
-- XGBoost Autonomous Decision Engine — initial schema
-- This file is auto-loaded by the Postgres Docker image on first boot.
-- (Spring Boot's Hibernate ddl-auto=update will additionally manage the entity
-- table; this file documents the schema and seeds optional indexes.)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS decisions (
    id              BIGSERIAL   PRIMARY KEY,
    transaction_id  VARCHAR(64) NOT NULL,
    amount          DOUBLE PRECISION NOT NULL,
    score           DOUBLE PRECISION NOT NULL,
    model_version   VARCHAR(64) NOT NULL,
    action          VARCHAR(16) NOT NULL,
    latency_ms      DOUBLE PRECISION NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_action     ON decisions (action);
CREATE INDEX IF NOT EXISTS idx_decisions_txn        ON decisions (transaction_id);

-- Optional: track model versions seen, with first/last observation timestamps.
CREATE TABLE IF NOT EXISTS model_versions (
    version       VARCHAR(64) PRIMARY KEY,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decisions_count BIGINT     NOT NULL DEFAULT 0
);
