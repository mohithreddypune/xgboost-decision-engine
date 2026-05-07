package com.decisionengine.api;

import java.util.Map;

import com.decisionengine.config.EngineProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * Thin proxy that exposes the ML service's /drift and /retrain endpoints under
 * the orchestrator host so the dashboard talks to a single origin.
 */
@RestController
@RequestMapping("/api/model")
public class DriftController {

    private final RestTemplate rest;
    private final EngineProperties props;

    public DriftController(RestTemplate mlRestTemplate, EngineProperties props) {
        this.rest = mlRestTemplate;
        this.props = props;
    }

    @GetMapping("/drift")
    public Map<String, Object> drift() {
        return rest.getForObject(props.getMlServiceUrl() + "/drift", Map.class);
    }

    @GetMapping("/health")
    public Map<String, Object> mlHealth() {
        return rest.getForObject(props.getMlServiceUrl() + "/health", Map.class);
    }

    @PostMapping("/retrain")
    public Map<String, Object> retrain() {
        return rest.postForObject(props.getMlServiceUrl() + "/retrain", null, Map.class);
    }

    @GetMapping("/last-retrain")
    public Map<String, Object> lastRetrain() {
        return rest.getForObject(props.getMlServiceUrl() + "/last-retrain", Map.class);
    }
}
