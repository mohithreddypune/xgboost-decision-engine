package com.decisionengine.analysis;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.decisionengine.model.Transaction;
import org.springframework.stereotype.Component;

/**
 * Meta-anomaly detection over a parsed file. Catches synthetic/manipulated data
 * patterns that the per-row XGBoost model can't see (it scores in isolation).
 */
@Component
public class AnomalyDetector {

    public List<AnalysisReport.Anomaly> detect(List<ParsedTransaction> rows) {
        List<AnalysisReport.Anomaly> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) return out;

        out.addAll(duplicateIds(rows));
        out.addAll(roundNumberBias(rows));
        out.addAll(repeatedAmounts(rows));
        out.addAll(impossibleHourCounts(rows));
        return out;
    }

    private List<AnalysisReport.Anomaly> duplicateIds(List<ParsedTransaction> rows) {
        Map<String, List<Integer>> byId = new HashMap<>();
        for (ParsedTransaction p : rows) {
            byId.computeIfAbsent(p.txn().transactionId(), k -> new ArrayList<>()).add(p.rowNumber());
        }
        List<Integer> dupRows = new ArrayList<>();
        int dupGroups = 0;
        for (var e : byId.entrySet()) {
            if (e.getValue().size() > 1) {
                dupGroups++;
                dupRows.addAll(e.getValue());
            }
        }
        if (dupGroups == 0) return List.of();
        String severity = dupGroups > 5 ? "high" : dupGroups > 1 ? "medium" : "low";
        return List.of(new AnalysisReport.Anomaly(
                "duplicate_transaction_id",
                severity,
                dupGroups + " transaction id(s) repeat across " + dupRows.size() + " rows. Synthetic-data signature.",
                dupRows
        ));
    }

    private List<AnalysisReport.Anomaly> roundNumberBias(List<ParsedTransaction> rows) {
        int total = rows.size();
        if (total < 20) return List.of();
        long round = rows.stream()
                .map(p -> p.txn().amount())
                .filter(a -> a == Math.floor(a) && (a % 50 == 0 || a % 100 == 0))
                .count();
        double pct = (double) round / total;
        if (pct < 0.30) return List.of();
        String severity = pct > 0.60 ? "high" : "medium";
        return List.of(new AnalysisReport.Anomaly(
                "round_number_bias",
                severity,
                String.format("%.0f%% of amounts are exact $50 / $100 multiples — uncommon in real transactions.", pct * 100),
                List.of()
        ));
    }

    private List<AnalysisReport.Anomaly> repeatedAmounts(List<ParsedTransaction> rows) {
        if (rows.size() < 10) return List.of();
        Map<Double, List<Integer>> byAmount = new HashMap<>();
        for (ParsedTransaction p : rows) {
            byAmount.computeIfAbsent(p.txn().amount(), k -> new ArrayList<>()).add(p.rowNumber());
        }
        List<Integer> repeated = new ArrayList<>();
        int groups = 0;
        for (var e : byAmount.entrySet()) {
            if (e.getValue().size() >= 5) {
                groups++;
                repeated.addAll(e.getValue());
            }
        }
        if (groups == 0) return List.of();
        return List.of(new AnalysisReport.Anomaly(
                "repeated_amount_clusters",
                groups > 3 ? "high" : "medium",
                groups + " amount value(s) repeat 5+ times across " + repeated.size() + " rows. Possible copy-paste fraud pattern.",
                repeated
        ));
    }

    private List<AnalysisReport.Anomaly> impossibleHourCounts(List<ParsedTransaction> rows) {
        if (rows.size() < 50) return List.of();
        Set<Integer> hoursSeen = new HashSet<>();
        for (ParsedTransaction p : rows) hoursSeen.add(p.txn().hourOfDay());
        if (hoursSeen.size() <= 3) {
            return List.of(new AnalysisReport.Anomaly(
                    "narrow_hour_distribution",
                    "medium",
                    "All transactions concentrated in only " + hoursSeen.size() + " distinct hour(s) of the day. Real traffic spans more hours.",
                    List.of()
            ));
        }
        return List.of();
    }
}
