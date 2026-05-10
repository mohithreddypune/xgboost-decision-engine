package com.decisionengine.explain;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class ExplainClient {

    private static final Logger log = LoggerFactory.getLogger(ExplainClient.class);

    private final RestTemplate rest;
    private final EngineProperties props;

    public ExplainClient(RestTemplate mlRestTemplate, EngineProperties props) {
        this.rest = mlRestTemplate;
        this.props = props;
    }

    public Explanation explainSafely(Transaction txn) {
        try {
            return explain(txn);
        } catch (Exception e) {
            log.warn("explain call failed: {}", e.getMessage());
            return new Explanation(txn.transactionId(), 0.5, "fallback", 0.0,
                    List.of(), "Explanation unavailable.");
        }
    }

    @SuppressWarnings("unchecked")
    public Explanation explain(Transaction txn) {
        String url = props.getMlServiceUrl() + "/explain";
        Map<String, Object> resp = rest.postForObject(url, txn, Map.class);
        if (resp == null) {
            return new Explanation(txn.transactionId(), 0.5, "unknown", 0.0,
                    List.of(), "No response.");
        }
        List<Map<String, Object>> rawContribs =
                (List<Map<String, Object>>) resp.getOrDefault("contributions", List.of());
        List<Reason> contribs = rawContribs.stream()
                .map(m -> new Reason(
                        (String) m.get("feature"),
                        ((Number) m.getOrDefault("value", 0)).doubleValue(),
                        ((Number) m.getOrDefault("contribution", 0)).doubleValue()
                )).toList();

        // The Explanation.topReasons() method below already sorts + filters + limits.
        return new Explanation(
                (String) resp.getOrDefault("transaction_id", txn.transactionId()),
                ((Number) resp.getOrDefault("score", 0)).doubleValue(),
                (String) resp.getOrDefault("model_version", "unknown"),
                ((Number) resp.getOrDefault("base_value", 0)).doubleValue(),
                contribs,
                (String) resp.getOrDefault("narrative", "")
        );
    }

    public record Reason(String feature, double value, double contribution) { }

    public static class Explanation {
        private final String transactionId;
        private final double score;
        private final String modelVersion;
        private final double baseValue;
        private final List<Reason> contributions;
        private final String narrative;

        public Explanation(String transactionId, double score, String modelVersion,
                            double baseValue, List<Reason> contributions, String narrative) {
            this.transactionId = transactionId;
            this.score = score;
            this.modelVersion = modelVersion;
            this.baseValue = baseValue;
            this.contributions = contributions;
            this.narrative = narrative;
        }

        public String transactionId() { return transactionId; }
        public double score() { return score; }
        public String modelVersion() { return modelVersion; }
        public double baseValue() { return baseValue; }
        public List<Reason> contributions() { return contributions; }
        public String narrative() { return narrative; }

        public List<Reason> topReasons() {
            return contributions.stream()
                    .filter(r -> r.contribution() > 0)
                    .sorted(Comparator.comparingDouble(Reason::contribution).reversed())
                    .limit(3)
                    .toList();
        }
    }
}
