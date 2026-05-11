package com.decisionengine.analysis;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Component;

/**
 * Holds the most recent N AnalysisReports in memory so the dashboard can
 * request a PDF for a previously-analyzed file (the upload-then-download flow).
 */
@Component
public class ReportCache {
    private static final int MAX_ENTRIES = 64;
    private final ConcurrentMap<String, AnalysisReport> store = new ConcurrentHashMap<>();
    private final java.util.Deque<String> order = new java.util.concurrent.ConcurrentLinkedDeque<>();

    public void put(AnalysisReport report) {
        store.put(report.fileId(), report);
        order.addLast(report.fileId());
        while (order.size() > MAX_ENTRIES) {
            String evict = order.pollFirst();
            if (evict != null) store.remove(evict);
        }
    }

    public AnalysisReport get(String fileId) {
        return store.get(fileId);
    }
}
