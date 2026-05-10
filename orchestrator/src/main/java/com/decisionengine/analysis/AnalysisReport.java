package com.decisionengine.analysis;

import java.util.List;
import java.util.Map;

/**
 * Result payload for the Document Fraud Analyzer.
 * Returned to the dashboard after a file is uploaded and processed.
 */
public record AnalysisReport(
        String fileId,
        String filename,
        Validity validity,
        String verdict,            // CLEAN / SUSPICIOUS / FRAUDULENT / INVALID
        double fraudRiskScore,     // aggregate 0..1
        double confidence,
        String summary,            // human-readable narrative
        Map<String, Long> actionBreakdown,
        List<Integer> scoreHistogram, // 10 bins of score distribution
        List<SuspiciousRow> topSuspicious,
        List<Anomaly> anomalies,
        long analysisTimeMs
) {
    public record Validity(
            boolean valid,
            String format,
            long sizeBytes,
            int rowCount,
            String schemaVersion,
            List<String> warnings,
            List<String> errors
    ) { }

    public record SuspiciousRow(
            int rowNumber,
            String transactionId,
            double amount,
            double score,
            String action,
            List<TopReason> topReasons
    ) { }

    public record TopReason(
            String feature,
            double value,
            double contribution
    ) { }

    public record Anomaly(
            String type,
            String severity,       // low / medium / high
            String description,
            List<Integer> affectedRows
    ) { }
}
