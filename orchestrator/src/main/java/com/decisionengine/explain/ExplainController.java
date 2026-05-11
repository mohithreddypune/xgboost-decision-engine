package com.decisionengine.explain;

import com.decisionengine.audit.Decision;
import com.decisionengine.audit.DecisionRepository;
import com.decisionengine.model.Transaction;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/explain")
public class ExplainController {

    private final ExplainClient explainer;
    private final DecisionRepository decisions;

    public ExplainController(ExplainClient explainer, DecisionRepository decisions) {
        this.explainer = explainer;
        this.decisions = decisions;
    }

    /** Explain an arbitrary transaction (used by the upload analyzer). */
    @PostMapping
    public ExplainClient.Explanation explain(@RequestBody Transaction txn) {
        return explainer.explainSafely(txn);
    }

    /**
     * Explain an audited decision by its ID. Used by the dashboard "Why?" modal —
     * the row already has the txn id and amount from the audit table; we don't
     * persist the full feature vector, so this endpoint reconstructs a synthetic
     * explanation from the score that's already on file. (For full reproducibility
     * we'd persist features in the audit row — Phase 2 enhancement.)
     */
    @GetMapping("/decision/{id}")
    public ExplainClient.Explanation explainDecision(@PathVariable Long id) {
        Decision d = decisions.findById(id).orElseThrow();
        // Reconstruct a Transaction from the audit row's amount alone.
        // The dashboard already shows score + action + amount; this gives a stable
        // explanation pegged to the model's average row at that amount.
        Transaction reconstructed = new Transaction(
                d.getTransactionId(),
                d.getAmount(),
                5,        // average merchant_category
                d.getCreatedAt().atZone(java.time.ZoneOffset.UTC).getHour(),
                isWeekend(d.getCreatedAt()),
                1, 0.0, 0.2, 5.0,
                d.getLat(), d.getLon(), d.getCity()
        );
        return explainer.explainSafely(reconstructed);
    }

    private static int isWeekend(java.time.Instant ts) {
        var day = ts.atZone(java.time.ZoneOffset.UTC).getDayOfWeek();
        return (day == java.time.DayOfWeek.SATURDAY || day == java.time.DayOfWeek.SUNDAY) ? 1 : 0;
    }
}
