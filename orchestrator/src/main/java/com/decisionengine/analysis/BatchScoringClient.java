package com.decisionengine.analysis;

import java.util.List;
import java.util.Map;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Transaction;
import com.decisionengine.scoring.ScoreResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Calls the ML service's /score-batch endpoint to score N transactions in one trip.
 */
@Component
public class BatchScoringClient {

    private final RestTemplate rest;
    private final EngineProperties props;

    public BatchScoringClient(RestTemplate mlRestTemplate, EngineProperties props) {
        this.rest = mlRestTemplate;
        this.props = props;
    }

    public BatchResult scoreBatch(List<Transaction> transactions) {
        String url = props.getMlServiceUrl() + "/score-batch";
        Map<String, List<Transaction>> body = Map.of("transactions", transactions);
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = rest.postForObject(url, body, Map.class);
        if (resp == null) {
            return new BatchResult("unknown", List.of());
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawScores = (List<Map<String, Object>>) resp.getOrDefault("scores", List.of());
        String version = (String) resp.getOrDefault("model_version", "unknown");
        List<ScoreResponse> scores = rawScores.stream()
                .map(m -> new ScoreResponse(
                        (String) m.get("transaction_id"),
                        ((Number) m.getOrDefault("score", 0.5)).doubleValue(),
                        (String) m.getOrDefault("model_version", version),
                        ((Number) m.getOrDefault("latency_ms", 0)).doubleValue()
                )).toList();
        return new BatchResult(version, scores);
    }

    public record BatchResult(String modelVersion, List<ScoreResponse> scores) { }
}
