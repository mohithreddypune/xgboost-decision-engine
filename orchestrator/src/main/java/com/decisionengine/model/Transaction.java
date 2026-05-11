package com.decisionengine.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Inbound event consumed from Kafka. Mirrors the simulator's payload.
 * lat/lon/city are optional — only present when the event was geotagged.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Transaction(
        @JsonProperty("transaction_id") String transactionId,
        double amount,
        @JsonProperty("merchant_category") int merchantCategory,
        @JsonProperty("hour_of_day") int hourOfDay,
        @JsonProperty("is_weekend") int isWeekend,
        @JsonProperty("txn_count_1h") int txnCount1h,
        @JsonProperty("amount_zscore_user") double amountZscoreUser,
        @JsonProperty("device_risk_score") double deviceRiskScore,
        @JsonProperty("geo_distance_km") double geoDistanceKm,
        @JsonProperty("lat") Double lat,
        @JsonProperty("lon") Double lon,
        @JsonProperty("city") String city
) { }
