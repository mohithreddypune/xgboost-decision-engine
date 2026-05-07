package com.decisionengine.websocket;

import java.time.Instant;

import com.decisionengine.audit.Decision;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class DecisionBroadcaster {

    private final SimpMessagingTemplate template;

    public DecisionBroadcaster(SimpMessagingTemplate template) {
        this.template = template;
    }

    public void broadcast(Decision decision) {
        template.convertAndSend("/topic/decisions", DecisionEvent.from(decision));
    }

    public record DecisionEvent(
            Long id,
            String transactionId,
            double amount,
            double score,
            String modelVersion,
            String action,
            double latencyMs,
            Instant createdAt
    ) {
        public static DecisionEvent from(Decision d) {
            return new DecisionEvent(
                    d.getId(),
                    d.getTransactionId(),
                    d.getAmount(),
                    d.getScore(),
                    d.getModelVersion(),
                    d.getAction().name(),
                    d.getLatencyMs(),
                    d.getCreatedAt()
            );
        }
    }
}
