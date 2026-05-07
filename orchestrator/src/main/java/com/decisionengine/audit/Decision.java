package com.decisionengine.audit;

import java.time.Instant;

import com.decisionengine.model.Action;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(
        name = "decisions",
        indexes = {
                @Index(name = "idx_decisions_created_at", columnList = "createdAt"),
                @Index(name = "idx_decisions_action", columnList = "action")
        }
)
public class Decision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String transactionId;

    @Column(nullable = false)
    private double amount;

    @Column(nullable = false)
    private double score;

    @Column(nullable = false, length = 64)
    private String modelVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Action action;

    @Column(nullable = false)
    private double latencyMs;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Decision() { }

    public Long getId() { return id; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String v) { this.transactionId = v; }
    public double getAmount() { return amount; }
    public void setAmount(double v) { this.amount = v; }
    public double getScore() { return score; }
    public void setScore(double v) { this.score = v; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String v) { this.modelVersion = v; }
    public Action getAction() { return action; }
    public void setAction(Action v) { this.action = v; }
    public double getLatencyMs() { return latencyMs; }
    public void setLatencyMs(double v) { this.latencyMs = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
}
