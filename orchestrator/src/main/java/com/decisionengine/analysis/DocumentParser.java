package com.decisionengine.analysis;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.decisionengine.model.Transaction;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Parses CSV / XLSX / XLS / JSON uploads into a list of ParsedTransaction.
 * Tolerates messy data — bad rows are reported as warnings, not failures.
 */
@Component
public class DocumentParser {

    private static final String[] REQUIRED = {
            "amount", "merchant_category", "hour_of_day", "is_weekend",
            "txn_count_1h", "amount_zscore_user", "device_risk_score", "geo_distance_km"
    };

    private final ObjectMapper mapper = new ObjectMapper();

    public ParseResult parse(MultipartFile file, String format) throws IOException {
        return switch (format.toUpperCase()) {
            case "CSV" -> parseCsv(file);
            case "XLSX", "XLS" -> parseExcel(file);
            case "JSON" -> parseJson(file);
            default -> throw new IllegalArgumentException("Unsupported format: " + format);
        };
    }

    private ParseResult parseCsv(MultipartFile file) throws IOException {
        List<ParsedTransaction> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (InputStream is = file.getInputStream();
             CSVReader r = new CSVReader(new java.io.InputStreamReader(is, StandardCharsets.UTF_8))) {
            String[] header;
            try {
                header = r.readNext();
            } catch (CsvValidationException e) {
                throw new IOException("CSV header read failed: " + e.getMessage());
            }
            if (header == null) return new ParseResult(rows, warnings);

            Map<String, Integer> idx = headerIndex(header);
            checkRequired(idx, warnings);

            String[] rec;
            int rowNum = 1; // 1 = header
            try {
                while ((rec = r.readNext()) != null) {
                    rowNum++;
                    Transaction t = toTransaction(rec, idx, rowNum, warnings);
                    if (t != null) rows.add(new ParsedTransaction(rowNum, t));
                }
            } catch (CsvValidationException e) {
                warnings.add("CSV stopped early at row " + rowNum + ": " + e.getMessage());
            }
        }
        return new ParseResult(rows, warnings);
    }

    private ParseResult parseExcel(MultipartFile file) throws IOException {
        List<ParsedTransaction> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try (InputStream is = file.getInputStream();
             Workbook wb = WorkbookFactory.create(is)) {
            Sheet sheet = wb.getSheetAt(0);
            if (sheet.getPhysicalNumberOfRows() == 0) return new ParseResult(rows, warnings);

            Row header = sheet.getRow(sheet.getFirstRowNum());
            String[] headers = new String[header.getLastCellNum()];
            for (int i = 0; i < header.getLastCellNum(); i++) {
                Cell c = header.getCell(i);
                headers[i] = c == null ? "" : c.toString().trim();
            }
            Map<String, Integer> idx = headerIndex(headers);
            checkRequired(idx, warnings);

            for (int r = sheet.getFirstRowNum() + 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String[] vals = new String[headers.length];
                for (int i = 0; i < headers.length; i++) {
                    Cell c = row.getCell(i);
                    vals[i] = c == null ? "" : cellAsString(c);
                }
                Transaction t = toTransaction(vals, idx, r + 1, warnings);
                if (t != null) rows.add(new ParsedTransaction(r + 1, t));
            }
        }
        return new ParseResult(rows, warnings);
    }

    private static String cellAsString(Cell c) {
        return switch (c.getCellType()) {
            case NUMERIC -> {
                double d = c.getNumericCellValue();
                if (d == Math.floor(d) && !Double.isInfinite(d)) yield Long.toString((long) d);
                yield Double.toString(d);
            }
            case STRING -> c.getStringCellValue();
            case BOOLEAN -> Boolean.toString(c.getBooleanCellValue());
            default -> "";
        };
    }

    private ParseResult parseJson(MultipartFile file) throws IOException {
        List<ParsedTransaction> rows = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        JsonNode root = mapper.readTree(file.getInputStream());
        // Accept either top-level array OR { "transactions": [ ... ] }
        JsonNode arr = root.isArray() ? root : root.path("transactions");
        if (!arr.isArray()) {
            warnings.add("JSON root must be array or contain 'transactions' array.");
            return new ParseResult(rows, warnings);
        }
        int i = 0;
        for (JsonNode node : arr) {
            i++;
            try {
                Transaction t = mapper.treeToValue(node, Transaction.class);
                rows.add(new ParsedTransaction(i, t));
            } catch (Exception e) {
                warnings.add("Row " + i + " skipped: " + e.getMessage());
            }
        }
        return new ParseResult(rows, warnings);
    }

    private static Map<String, Integer> headerIndex(String[] header) {
        Map<String, Integer> m = new HashMap<>();
        for (int i = 0; i < header.length; i++) {
            if (header[i] != null) m.put(header[i].trim().toLowerCase(), i);
        }
        return m;
    }

    private static void checkRequired(Map<String, Integer> idx, List<String> warnings) {
        List<String> missing = new ArrayList<>();
        for (String r : REQUIRED) if (!idx.containsKey(r)) missing.add(r);
        if (!missing.isEmpty()) warnings.add("Missing required columns: " + missing);
    }

    private static Transaction toTransaction(String[] rec, Map<String, Integer> idx,
                                              int rowNum, List<String> warnings) {
        try {
            String id = rec.length > idxOf(idx, "transaction_id")
                    ? rec[idxOf(idx, "transaction_id")] : "auto-" + UUID.randomUUID().toString().substring(0, 8);
            if (id == null || id.isBlank()) id = "auto-" + UUID.randomUUID().toString().substring(0, 8);

            return new Transaction(
                    id,
                    parseDouble(rec, idx, "amount"),
                    (int) parseDouble(rec, idx, "merchant_category"),
                    (int) parseDouble(rec, idx, "hour_of_day"),
                    (int) parseDouble(rec, idx, "is_weekend"),
                    (int) parseDouble(rec, idx, "txn_count_1h"),
                    parseDouble(rec, idx, "amount_zscore_user"),
                    parseDouble(rec, idx, "device_risk_score"),
                    parseDouble(rec, idx, "geo_distance_km")
            );
        } catch (Exception e) {
            warnings.add("Row " + rowNum + " skipped: " + e.getMessage());
            return null;
        }
    }

    private static int idxOf(Map<String, Integer> idx, String key) {
        Integer i = idx.get(key);
        return i == null ? Integer.MAX_VALUE : i;
    }

    private static double parseDouble(String[] rec, Map<String, Integer> idx, String key) {
        Integer i = idx.get(key);
        if (i == null || i >= rec.length || rec[i] == null || rec[i].isBlank()) return 0.0;
        return Double.parseDouble(rec[i].trim());
    }

    public record ParseResult(List<ParsedTransaction> rows, List<String> warnings) { }
}
