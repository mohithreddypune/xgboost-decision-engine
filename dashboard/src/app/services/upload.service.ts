import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AnalysisReport {
  fileId: string;
  filename: string;
  validity: {
    valid: boolean;
    format: string;
    sizeBytes: number;
    rowCount: number;
    schemaVersion: string;
    warnings: string[];
    errors: string[];
  };
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'FRAUDULENT' | 'INVALID';
  fraudRiskScore: number;
  confidence: number;
  summary: string;
  actionBreakdown: Record<string, number>;
  scoreHistogram: number[];
  topSuspicious: Array<{
    rowNumber: number;
    transactionId: string;
    amount: number;
    score: number;
    action: string;
    topReasons: Array<{ feature: string; value: number; contribution: number }>;
  }>;
  anomalies: Array<{
    type: string;
    severity: string;
    description: string;
    affectedRows: number[];
  }>;
  analysisTimeMs: number;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  upload(file: File): Observable<AnalysisReport> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<AnalysisReport>('/api/analyze/upload', fd);
  }
}
