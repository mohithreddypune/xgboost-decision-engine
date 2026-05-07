package com.decisionengine.scoring;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ScoreResponse(
        @JsonProperty("transaction_id") String transactionId,
        double score,
        @JsonProperty("model_version") String modelVersion,
        @JsonProperty("latency_ms") double latencyMs
) { }
