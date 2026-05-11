package com.decisionengine.api;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import com.decisionengine.audit.Decision;
import com.decisionengine.audit.DecisionRepository;
import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Action;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * Phase 2 endpoints: drift history, perf benchmarks, time-series, map data.
 */
@RestController
@RequestMapping("/api/insights")
public class InsightsController {

    private final RestTemplate rest;
    private final EngineProperties props;
    private final DecisionRepository decisions;

    public InsightsController(RestTemplate mlRestTemplate,
                               EngineProperties props,
                               DecisionRepository decisions) {
        this.rest = mlRestTemplate;
        this.props = props;
        this.decisions = decisions;
    }

    /** 24h drift history (proxied from ML service). */
    @GetMapping("/drift-history")
    public Map<String, Object> driftHistory() {
        return rest.getForObject(props.getMlServiceUrl() + "/drift/history", Map.class);
    }

    /** Rolling p50/p95/p99 latency stats. */
    @GetMapping("/perf")
    public Map<String, Object> perf() {
        return rest.getForObject(props.getMlServiceUrl() + "/perf", Map.class);
    }

    /** Decisions/minute over the last `minutes` minutes, stacked by action. */
    @GetMapping("/timeseries")
    public Map<String, Object> timeseries(@RequestParam(defaultValue = "60") int minutes) {
        Instant since = Instant.now().minus(minutes, ChronoUnit.MINUTES);
        List<Decision> rows = decisions.findAll().stream()
                .filter(d -> d.getCreatedAt().isAfter(since))
                .toList();

        // Bucket by minute → map<minute, map<action, count>>
        TreeMap<Long, Map<String, Long>> buckets = new TreeMap<>();
        long sinceMs = since.toEpochMilli();
        long nowMs = System.currentTimeMillis();
        for (long t = sinceMs / 60_000 * 60_000; t <= nowMs; t += 60_000) {
            Map<String, Long> empty = new HashMap<>();
            for (Action a : Action.values()) empty.put(a.name(), 0L);
            buckets.put(t, empty);
        }
        for (Decision d : rows) {
            long bucket = d.getCreatedAt().toEpochMilli() / 60_000 * 60_000;
            buckets.computeIfAbsent(bucket, k -> {
                Map<String, Long> m = new HashMap<>();
                for (Action a : Action.values()) m.put(a.name(), 0L);
                return m;
            });
            buckets.get(bucket).merge(d.getAction().name(), 1L, Long::sum);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("windowMinutes", minutes);
        body.put("buckets", buckets.entrySet().stream().map(e -> {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("ts", e.getKey());
            b.putAll(e.getValue());
            return b;
        }).toList());
        return body;
    }

    /** Recent geo-tagged decisions for the live transaction map. */
    @GetMapping("/map/recent")
    public List<Map<String, Object>> mapRecent(@RequestParam(defaultValue = "200") int limit) {
        return decisions.findTop100ByOrderByCreatedAtDesc().stream()
                .filter(d -> d.getLat() != null && d.getLon() != null)
                .limit(limit)
                .map(d -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", d.getId());
                    m.put("transactionId", d.getTransactionId());
                    m.put("amount", d.getAmount());
                    m.put("score", d.getScore());
                    m.put("action", d.getAction().name());
                    m.put("lat", d.getLat());
                    m.put("lon", d.getLon());
                    m.put("city", d.getCity());
                    m.put("createdAt", d.getCreatedAt().toString());
                    return m;
                }).toList();
    }
}
