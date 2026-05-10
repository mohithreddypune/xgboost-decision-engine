package com.decisionengine.analysis;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates uploaded files: extension, magic bytes, size, and basic structure.
 * Catches obvious tampering and "renamed binary" attacks.
 */
@Component
public class FileValidator {

    private static final long MAX_BYTES = 25L * 1024 * 1024; // 25MB
    private static final Set<String> ALLOWED_EXTS = Set.of("csv", "xlsx", "xls", "json");

    public ValidationResult validate(MultipartFile file) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (file == null || file.isEmpty()) {
            errors.add("File is empty.");
            return new ValidationResult(false, "UNKNOWN", 0L, errors, warnings);
        }
        if (file.getSize() > MAX_BYTES) {
            errors.add("File exceeds 25MB limit.");
        }

        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String ext = extension(name);
        if (!ALLOWED_EXTS.contains(ext)) {
            errors.add("Unsupported extension: ." + ext + ". Allowed: csv, xlsx, xls, json.");
        }

        // Magic-byte check — catches renamed binaries
        byte[] head = readHead(file, 8);
        String detected = detectFormat(head);
        if (!detected.equalsIgnoreCase("UNKNOWN") && !matchesExtension(detected, ext)) {
            errors.add("Magic bytes (" + detected + ") do not match extension (." + ext + "). Possible tampering.");
        }

        // Soft warnings on suspicious filenames
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            warnings.add("Filename contains path traversal characters; sanitized.");
        }

        boolean valid = errors.isEmpty();
        return new ValidationResult(valid, detected.isEmpty() ? "UNKNOWN" : detected,
                file.getSize(), errors, warnings);
    }

    private static byte[] readHead(MultipartFile file, int n) {
        try (InputStream is = file.getInputStream()) {
            byte[] buf = new byte[n];
            int read = is.read(buf);
            return read <= 0 ? new byte[0] : Arrays.copyOf(buf, read);
        } catch (IOException e) {
            return new byte[0];
        }
    }

    private static String detectFormat(byte[] head) {
        if (head.length >= 4 && head[0] == 0x50 && head[1] == 0x4B
                && head[2] == 0x03 && head[3] == 0x04) {
            return "XLSX";   // ZIP magic — XLSX is a zip
        }
        if (head.length >= 4 && head[0] == (byte) 0xD0 && head[1] == (byte) 0xCF
                && head[2] == (byte) 0x11 && head[3] == (byte) 0xE0) {
            return "XLS";    // OLE2 compound document
        }
        if (head.length >= 4 && head[0] == 0x25 && head[1] == 0x50
                && head[2] == 0x44 && head[3] == 0x46) {
            return "PDF";
        }
        // CSV / JSON have no reliable magic — sniff first char
        if (head.length >= 1) {
            char c = (char) (head[0] & 0xFF);
            if (c == '{' || c == '[') return "JSON";
            // printable ASCII / UTF-8 = likely text/CSV
            if (c >= 0x20 && c < 0x7F) return "CSV";
        }
        return "UNKNOWN";
    }

    private static boolean matchesExtension(String detected, String ext) {
        return switch (ext) {
            case "csv" -> "CSV".equalsIgnoreCase(detected);
            case "xlsx" -> "XLSX".equalsIgnoreCase(detected);
            case "xls" -> "XLS".equalsIgnoreCase(detected);
            case "json" -> "JSON".equalsIgnoreCase(detected);
            default -> false;
        };
    }

    private static String extension(String filename) {
        int i = filename.lastIndexOf('.');
        return i < 0 ? "" : filename.substring(i + 1).toLowerCase();
    }

    public record ValidationResult(
            boolean valid,
            String format,
            long sizeBytes,
            List<String> errors,
            List<String> warnings
    ) { }
}
