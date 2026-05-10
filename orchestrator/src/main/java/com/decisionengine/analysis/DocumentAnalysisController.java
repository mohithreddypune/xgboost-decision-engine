package com.decisionengine.analysis;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/analyze")
public class DocumentAnalysisController {

    private final DocumentAnalysisService service;

    public DocumentAnalysisController(DocumentAnalysisService service) {
        this.service = service;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnalysisReport> upload(@RequestParam("file") MultipartFile file) {
        AnalysisReport report = service.analyze(file);
        return ResponseEntity.ok(report);
    }
}
