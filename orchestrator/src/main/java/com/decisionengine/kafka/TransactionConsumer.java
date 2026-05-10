package com.decisionengine.kafka;

import com.decisionengine.alerts.AnomalyAlertService;
import com.decisionengine.audit.AuditService;
import com.decisionengine.audit.Decision;
import com.decisionengine.model.Action;
import com.decisionengine.model.Transaction;
import com.decisionengine.routing.DecisionRouter;
import com.decisionengine.scoring.ScoreResponse;
import com.decisionengine.scoring.ScoringClient;
import com.decisionengine.websocket.DecisionBroadcaster;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class TransactionConsumer {

    private static final Logger log = LoggerFactory.getLogger(TransactionConsumer.class);

    private final ObjectMapper mapper;
    private final ScoringClient scoringClient;
    private final DecisionRouter router;
    private final AuditService audit;
    private final DecisionBroadcaster broadcaster;
    private final AnomalyAlertService alerts;

    public TransactionConsumer(
            ObjectMapper mapper,
            ScoringClient scoringClient,
            DecisionRouter router,
            AuditService audit,
            DecisionBroadcaster broadcaster,
            AnomalyAlertService alerts) {
        this.mapper = mapper;
        this.scoringClient = scoringClient;
        this.router = router;
        this.audit = audit;
        this.broadcaster = broadcaster;
        this.alerts = alerts;
    }

    @KafkaListener(topics = "${decision-engine.topic}", groupId = "decision-engine")
    public void onTransaction(String payload) {
        Transaction txn;
        try {
            txn = mapper.readValue(payload, Transaction.class);
        } catch (JsonProcessingException e) {
            log.warn("malformed payload: {}", e.getMessage());
            return;
        }

        ScoreResponse score = scoringClient.score(txn);
        Action action = router.route(score.score());
        Decision saved = audit.persist(txn, score, action);
        broadcaster.broadcast(saved);
        alerts.onDecision(saved);

        log.debug("decided txn={} score={} action={} model={}",
                txn.transactionId(), score.score(), action, score.modelVersion());
    }
}
