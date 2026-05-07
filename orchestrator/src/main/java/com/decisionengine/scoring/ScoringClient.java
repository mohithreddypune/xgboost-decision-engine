package com.decisionengine.scoring;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Component
public class ScoringClient {

    private static final Logger log = LoggerFactory.getLogger(ScoringClient.class);

    private final RestTemplate rest;
    private final EngineProperties props;

    public ScoringClient(RestTemplate mlRestTemplate, EngineProperties props) {
        this.rest = mlRestTemplate;
        this.props = props;
    }

    public ScoreResponse score(Transaction txn) {
        String url = props.getMlServiceUrl() + "/score";
        try {
            return rest.postForObject(url, txn, ScoreResponse.class);
        } catch (RestClientException e) {
            log.error("scoring service call failed for txn={}: {}", txn.transactionId(), e.getMessage());
            // Fail-safe: degrade gracefully — return a neutral score with a sentinel version.
            return new ScoreResponse(txn.transactionId(), 0.5, "fallback", 0.0);
        }
    }
}
