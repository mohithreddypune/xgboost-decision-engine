package com.decisionengine.analysis;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

/**
 * Generates a one-page PDF report for an AnalysisReport. Uses PDFBox primitives
 * — no charts (would require an extra rendering library), but lays out the key
 * numbers, verdict, anomalies, and top suspicious rows in a clean format.
 */
@Component
public class PdfReportBuilder {

    public byte[] build(AnalysisReport r) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            float W = page.getMediaBox().getWidth();
            float H = page.getMediaBox().getHeight();
            float margin = 48f;
            float y = H - margin;

            try (PDPageContentStream c = new PDPageContentStream(doc, page)) {
                // ── Header bar ──
                c.setNonStrokingColor(new Color(0x06, 0x09, 0x1A));
                c.addRect(0, H - 80, W, 80);
                c.fill();
                c.setNonStrokingColor(Color.WHITE);
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 20);
                c.newLineAtOffset(margin, H - 50);
                c.showText("XGBoost Decision Engine — Fraud Analysis Report");
                c.endText();

                y = H - 120;

                // ── Verdict ──
                Color vColor = switch (r.verdict()) {
                    case "FRAUDULENT" -> new Color(0xEF, 0x44, 0x44);
                    case "SUSPICIOUS" -> new Color(0xFB, 0xBF, 0x24);
                    case "CLEAN"      -> new Color(0x00, 0xD6, 0x8F);
                    default           -> new Color(0x60, 0x60, 0x60);
                };
                c.setNonStrokingColor(vColor);
                c.addRect(margin, y - 36, 8, 36);
                c.fill();

                c.setNonStrokingColor(Color.BLACK);
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 18);
                c.newLineAtOffset(margin + 18, y - 14);
                c.showText("Verdict: " + r.verdict());
                c.endText();

                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                c.setNonStrokingColor(new Color(0x60, 0x60, 0x60));
                c.newLineAtOffset(margin + 18, y - 30);
                c.showText(String.format("Risk score: %.3f   ·   File: %s   ·   %d rows",
                        r.fraudRiskScore(), safe(r.filename()), r.validity().rowCount()));
                c.endText();

                y -= 70;

                // ── Action breakdown grid ──
                c.setNonStrokingColor(Color.BLACK);
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
                c.newLineAtOffset(margin, y);
                c.showText("Action breakdown");
                c.endText();
                y -= 22;
                String[] actions = {"BLOCK", "FLAG", "STEP_UP", "APPROVE"};
                Color[] colors = {
                        new Color(0xEF, 0x44, 0x44), new Color(0xFB, 0xBF, 0x24),
                        new Color(0x3B, 0x82, 0xF6), new Color(0x00, 0xD6, 0x8F)
                };
                float colW = (W - margin * 2) / 4f;
                for (int i = 0; i < 4; i++) {
                    long cnt = r.actionBreakdown().getOrDefault(actions[i], 0L);
                    c.setNonStrokingColor(colors[i]);
                    c.addRect(margin + i * colW, y - 50, colW - 10, 50);
                    c.fill();
                    c.setNonStrokingColor(Color.WHITE);
                    c.beginText();
                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                    c.newLineAtOffset(margin + i * colW + 10, y - 18);
                    c.showText(actions[i]);
                    c.endText();
                    c.beginText();
                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 22);
                    c.newLineAtOffset(margin + i * colW + 10, y - 42);
                    c.showText(String.valueOf(cnt));
                    c.endText();
                }
                y -= 80;

                // ── Summary ──
                c.setNonStrokingColor(Color.BLACK);
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
                c.newLineAtOffset(margin, y);
                c.showText("Summary");
                c.endText();
                y -= 16;
                y = wrap(c, r.summary(), margin, y, W - margin * 2, 10);
                y -= 14;

                // ── Anomalies ──
                if (!r.anomalies().isEmpty()) {
                    c.beginText();
                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
                    c.newLineAtOffset(margin, y);
                    c.showText("Meta-anomalies");
                    c.endText();
                    y -= 16;
                    for (var a : r.anomalies()) {
                        c.beginText();
                        c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 10);
                        c.setNonStrokingColor(new Color(0xB4, 0x53, 0x09));
                        c.newLineAtOffset(margin, y);
                        c.showText("[" + a.severity().toUpperCase() + "] " + a.type());
                        c.endText();
                        c.setNonStrokingColor(Color.BLACK);
                        y -= 14;
                        y = wrap(c, "  " + a.description(), margin, y, W - margin * 2, 9);
                        y -= 6;
                    }
                    y -= 10;
                }

                // ── Top suspicious table ──
                if (!r.topSuspicious().isEmpty()) {
                    c.beginText();
                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
                    c.newLineAtOffset(margin, y);
                    c.showText("Top suspicious rows");
                    c.endText();
                    y -= 18;
                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                    String[] cols = {"Row", "Txn ID", "Amount", "Score", "Action"};
                    float[] x = { margin, margin + 40, margin + 160, margin + 230, margin + 290 };
                    c.setNonStrokingColor(new Color(0x60, 0x60, 0x60));
                    for (int i = 0; i < cols.length; i++) {
                        c.beginText();
                        c.newLineAtOffset(x[i], y);
                        c.showText(cols[i]);
                        c.endText();
                    }
                    y -= 6;
                    c.setStrokingColor(new Color(0xCC, 0xCC, 0xCC));
                    c.moveTo(margin, y); c.lineTo(W - margin, y); c.stroke();
                    y -= 12;

                    c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 9);
                    c.setNonStrokingColor(Color.BLACK);
                    int maxRows = Math.min(10, r.topSuspicious().size());
                    for (int i = 0; i < maxRows; i++) {
                        var sr = r.topSuspicious().get(i);
                        c.beginText(); c.newLineAtOffset(x[0], y); c.showText(String.valueOf(sr.rowNumber())); c.endText();
                        c.beginText(); c.newLineAtOffset(x[1], y); c.showText(safe(sr.transactionId())); c.endText();
                        c.beginText(); c.newLineAtOffset(x[2], y); c.showText(String.format("$%,.2f", sr.amount())); c.endText();
                        c.beginText(); c.newLineAtOffset(x[3], y); c.showText(String.format("%.3f", sr.score())); c.endText();
                        c.beginText(); c.newLineAtOffset(x[4], y); c.showText(sr.action()); c.endText();
                        y -= 14;
                        if (y < margin + 60) break;
                    }
                }

                // ── Footer ──
                c.setNonStrokingColor(new Color(0x88, 0x88, 0x88));
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
                c.newLineAtOffset(margin, margin - 16);
                c.showText("Generated " + Instant.now() + "   ·   File ID: " + safe(r.fileId())
                        + "   ·   Analysis time: " + r.analysisTimeMs() + " ms");
                c.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private static float wrap(PDPageContentStream c, String text, float x, float y,
                              float maxWidth, float fontSize) throws IOException {
        c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), fontSize);
        // Naive word wrap — assumes ~6.0 px per character at fontSize 10
        int maxChars = (int) (maxWidth / (fontSize * 0.55));
        for (String line : softWrap(text == null ? "" : text, maxChars)) {
            c.beginText();
            c.newLineAtOffset(x, y);
            c.showText(safe(line));
            c.endText();
            y -= fontSize + 3;
        }
        return y;
    }

    private static String[] softWrap(String s, int max) {
        if (s.length() <= max) return new String[]{s};
        java.util.List<String> out = new java.util.ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : s.split(" ")) {
            if (line.length() + word.length() + 1 > max) {
                out.add(line.toString()); line.setLength(0);
            }
            if (!line.isEmpty()) line.append(' ');
            line.append(word);
        }
        if (!line.isEmpty()) out.add(line.toString());
        return out.toArray(new String[0]);
    }

    private static String safe(String s) {
        if (s == null) return "";
        return s.replaceAll("[^\\x20-\\x7E]", "?");  // PDFBox HELVETICA can't render unicode
    }
}
