package com.decisionengine.analysis;

import java.io.IOException;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/analyze")
public class DocumentAnalysisController {

    private final DocumentAnalysisService service;
    private final ReportCache cache;
    private final PdfReportBuilder pdfBuilder;

    public DocumentAnalysisController(DocumentAnalysisService service,
                                      ReportCache cache,
                                      PdfReportBuilder pdfBuilder) {
        this.service = service;
        this.cache = cache;
        this.pdfBuilder = pdfBuilder;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnalysisReport> upload(@RequestParam("file") MultipartFile file) {
        AnalysisReport report = service.analyze(file);
        return ResponseEntity.ok(report);
    }

    @GetMapping(value = "/report/{fileId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String fileId) throws IOException {
        AnalysisReport report = cache.get(fileId);
        if (report == null) return ResponseEntity.notFound().build();
        byte[] pdf = pdfBuilder.build(report);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"fraud-analysis-" + fileId + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
