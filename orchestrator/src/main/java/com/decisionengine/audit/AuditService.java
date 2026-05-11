package com.decisionengine.audit;

import com.decisionengine.model.Action;
import com.decisionengine.model.Transaction;
import com.decisionengine.scoring.ScoreResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final DecisionRepository repo;

    public AuditService(DecisionRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public Decision persist(Transaction txn, ScoreResponse score, Action action) {
        Decision d = new Decision();
        d.setTransactionId(txn.transactionId());
        d.setAmount(txn.amount());
        d.setScore(score.score());
        d.setModelVersion(score.modelVersion());
        d.setAction(action);
        d.setLatencyMs(score.latencyMs());
        d.setLat(txn.lat());
        d.setLon(txn.lon());
        d.setCity(txn.city());
        return repo.save(d);
    }
}
