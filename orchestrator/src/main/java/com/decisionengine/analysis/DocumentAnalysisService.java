package com.decisionengine.analysis;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.explain.ExplainClient;
import com.decisionengine.explain.ExplainClient.Explanation;
import com.decisionengine.model.Action;
import com.decisionengine.model.Transaction;
import com.decisionengine.routing.DecisionRouter;
import com.decisionengine.scoring.ScoreResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Orchestrates: validate → parse → batch-score → detect anomalies → build report.
 */
@Service
public class DocumentAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(DocumentAnalysisService.class);

    private final FileValidator validator;
    private final DocumentParser parser;
    private final BatchScoringClient batch;
    private final AnomalyDetector anomalies;
    private final DecisionRouter router;
    private final ExplainClient explainer;

    public DocumentAnalysisService(FileValidator validator,
                                   DocumentParser parser,
                                   BatchScoringClient batch,
                                   AnomalyDetector anomalies,
                                   DecisionRouter router,
                                   ExplainClient explainer) {
        this.validator = validator;
        this.parser = parser;
        this.batch = batch;
        this.anomalies = anomalies;
        this.router = router;
        this.explainer = explainer;
    }

    public AnalysisReport analyze(MultipartFile file) {
        long start = System.currentTimeMillis();
        String fileId = UUID.randomUUID().toString();
        String filename = file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename();

        // 1) validate
        FileValidator.ValidationResult v = validator.validate(file);
        if (!v.valid()) {
            return invalidReport(fileId, filename, v, start);
        }

        // 2) parse
        DocumentParser.ParseResult parsed;
        try {
            parsed = parser.parse(file, v.format());
        } catch (IOException e) {
            log.warn("parse failed: {}", e.getMessage());
            List<String> errs = new ArrayList<>(v.errors());
            errs.add("Parse error: " + e.getMessage());
            return invalidReport(fileId, filename,
                    new FileValidator.ValidationResult(false, v.format(), v.sizeBytes(), errs, v.warnings()),
                    start);
        }
        List<ParsedTransaction> rows = parsed.rows();
        List<String> warnings = new ArrayList<>(v.warnings());
        warnings.addAll(parsed.warnings());

        if (rows.isEmpty()) {
            return new AnalysisReport(
                    fileId, filename,
                    new AnalysisReport.Validity(false, v.format(), v.sizeBytes(),
                            0, "transaction_v1", warnings, List.of("No parseable rows.")),
                    "INVALID", 0.0, 0.0, "No parseable rows in file.",
                    Map.of(), List.of(), List.of(), List.of(),
                    System.currentTimeMillis() - start
            );
        }

        // 3) batch-score
        List<Transaction> txns = rows.stream().map(ParsedTransaction::txn).toList();
        BatchScoringClient.BatchResult scored = batch.scoreBatch(txns);
        if (scored.scores().size() != rows.size()) {
            warnings.add("Score count mismatch — partial results.");
        }

        // 4) compute aggregates
        Map<String, Long> actionCounts = new HashMap<>();
        for (Action a : Action.values()) actionCounts.put(a.name(), 0L);
        int[] histogram = new int[10];
        AtomicLong totalScoreX1000 = new AtomicLong();
        List<RowScore> rowScores = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            ScoreResponse sr = scored.scores().get(Math.min(i, scored.scores().size() - 1));
            Action act = router.route(sr.score());
            actionCounts.merge(act.name(), 1L, Long::sum);
            int bin = Math.min(9, Math.max(0, (int) (sr.score() * 10.0)));
            histogram[bin]++;
            totalScoreX1000.addAndGet((long) (sr.score() * 1000));
            rowScores.add(new RowScore(rows.get(i), sr.score(), act));
        }

        double avgScore = totalScoreX1000.get() / 1000.0 / rows.size();
        long blockCount = actionCounts.getOrDefault("BLOCK", 0L);
        long flagCount = actionCounts.getOrDefault("FLAG", 0L);
        double riskRatio = (blockCount + flagCount) / (double) rows.size();

        String verdict;
        if (riskRatio >= 0.20) verdict = "FRAUDULENT";
        else if (riskRatio >= 0.05 || avgScore >= 0.30) verdict = "SUSPICIOUS";
        else verdict = "CLEAN";

        // 5) top suspicious rows + their SHAP-style reasons
        List<AnalysisReport.SuspiciousRow> top = rowScores.stream()
                .sorted((a, b) -> Double.compare(b.score, a.score))
                .limit(20)
                .map(rs -> {
                    List<AnalysisReport.TopReason> reasons;
                    if (rs.score >= 0.20) {
                        Explanation exp = explainer.explainSafely(rs.parsed.txn());
                        reasons = exp.topReasons().stream()
                                .map(t -> new AnalysisReport.TopReason(
                                        t.feature(), t.value(), t.contribution()))
                                .toList();
                    } else {
                        reasons = List.of();
                    }
                    return new AnalysisReport.SuspiciousRow(
                            rs.parsed.rowNumber(),
                            rs.parsed.txn().transactionId(),
                            rs.parsed.txn().amount(),
                            rs.score,
                            rs.action.name(),
                            reasons
                    );
                })
                .toList();

        // 6) meta-anomalies
        List<AnalysisReport.Anomaly> anomList = anomalies.detect(rows);

        // 7) summary narrative
        String summary = buildSummary(rows.size(), blockCount, flagCount, avgScore, anomList);

        long elapsed = System.currentTimeMillis() - start;

        return new AnalysisReport(
                fileId,
                filename,
                new AnalysisReport.Validity(true, v.format(), v.sizeBytes(),
                        rows.size(), "transaction_v1", warnings, List.of()),
                verdict,
                round3(riskRatio),
                round3(Math.min(1.0, 0.5 + Math.abs(avgScore - 0.5))),
                summary,
                actionCounts,
                java.util.Arrays.stream(histogram).boxed().toList(),
                top,
                anomList,
                elapsed
        );
    }

    private static AnalysisReport invalidReport(String fileId, String filename,
                                                FileValidator.ValidationResult v,
                                                long start) {
        return new AnalysisReport(
                fileId, filename,
                new AnalysisReport.Validity(false, v.format(), v.sizeBytes(),
                        0, "unknown", v.warnings(), v.errors()),
                "INVALID", 0.0, 1.0,
                "File failed validation: " + String.join("; ", v.errors()),
                Map.of(), List.of(), List.of(), List.of(),
                System.currentTimeMillis() - start
        );
    }

    private static String buildSummary(int total, long blocks, long flags,
                                        double avg, List<AnalysisReport.Anomaly> anomalies) {
        double pct = (blocks + flags) * 100.0 / Math.max(total, 1);
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Analyzed %,d rows. ", total));
        sb.append(String.format("%d would be BLOCKED and %d FLAGGED — %.1f%% high-risk. ",
                blocks, flags, pct));
        sb.append(String.format("Average fraud score: %.3f. ", avg));
        if (!anomalies.isEmpty()) {
            sb.append("Meta-anomalies detected: ");
            sb.append(String.join(", ", anomalies.stream().map(AnalysisReport.Anomaly::type).toList()));
            sb.append(".");
        } else {
            sb.append("No structural anomalies in file metadata.");
        }
        return sb.toString();
    }

    private static double round3(double d) {
        return Math.round(d * 1000.0) / 1000.0;
    }

    private record RowScore(ParsedTransaction parsed, double score, Action action) { }
}
