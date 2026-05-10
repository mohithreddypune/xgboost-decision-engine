package com.decisionengine.alerts;

import java.time.Instant;
import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

import com.decisionengine.audit.Decision;
import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Action;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * Watches the live decision stream + drift state and emits anomaly alerts to
 * `/topic/alerts`. The dashboard's toast service subscribes and renders them.
 */
@Service
public class AnomalyAlertService {

    private static final Logger log = LoggerFactory.getLogger(AnomalyAlertService.class);

    private final SimpMessagingTemplate template;
    private final RestTemplate rest;
    private final EngineProperties props;

    private final Deque<Long> recentBlockTimestamps = new ConcurrentLinkedDeque<>();
    private final AtomicLong lastDriftAlertAt = new AtomicLong(0);
    private final AtomicLong lastBlockSpikeAt = new AtomicLong(0);

    public AnomalyAlertService(SimpMessagingTemplate template,
                                RestTemplate mlRestTemplate,
                                EngineProperties props) {
        this.template = template;
        this.rest = mlRestTemplate;
        this.props = props;
    }

    public void onDecision(Decision d) {
        if (d.getAction() == Action.BLOCK) {
            long now = System.currentTimeMillis();
            recentBlockTimestamps.addLast(now);
            // prune older than 30s
            while (!recentBlockTimestamps.isEmpty()
                    && now - recentBlockTimestamps.peekFirst() > 30_000) {
                recentBlockTimestamps.pollFirst();
            }
            if (recentBlockTimestamps.size() >= 5
                    && now - lastBlockSpikeAt.get() > 60_000) {
                lastBlockSpikeAt.set(now);
                publish(new Alert(
                        "block_spike", "warning",
                        recentBlockTimestamps.size() + " BLOCK actions in last 30s",
                        "Possible coordinated fraud burst — investigate immediately.",
                        Instant.now().toString()
                ));
            }
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void checkDrift() {
        try {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> resp =
                    rest.getForObject(props.getMlServiceUrl() + "/drift", java.util.Map.class);
            if (resp == null) return;
            boolean drifted = Boolean.TRUE.equals(resp.get("drifted"));
            double maxPsi = ((Number) resp.getOrDefault("max_psi", 0)).doubleValue();
            long now = System.currentTimeMillis();
            if (drifted && now - lastDriftAlertAt.get() > 5 * 60_000) {
                lastDriftAlertAt.set(now);
                publish(new Alert(
                        "drift_detected", "warning",
                        String.format("Model drift detected (max PSI = %.3f)", maxPsi),
                        "Live feature distribution has shifted from training data. Consider retraining.",
                        Instant.now().toString()
                ));
            }
        } catch (Exception e) {
            log.debug("drift check skipped: {}", e.getMessage());
        }
    }

    private void publish(Alert a) {
        log.info("alert: {} — {}", a.type(), a.title());
        template.convertAndSend("/topic/alerts", a);
    }

    public record Alert(
            String type,
            String severity,   // info | warning | error
            String title,
            String body,
            String timestamp
    ) { }
}
