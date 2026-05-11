import { Component } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { UploadService, AnalysisReport } from '../services/upload.service';
import { SkeletonComponent } from './skeleton.component';
import { AnimatedCounterComponent } from './animated-counter.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, DecimalPipe, SkeletonComponent, AnimatedCounterComponent],
  template: `
    <div class="page">
      <h2 class="title">Document Fraud Analyzer</h2>
      <p class="subtitle">Upload a CSV, XLSX, XLS, or JSON of transactions. The system validates the file, scores every row, detects meta-anomalies, and gives a verdict — all in seconds.</p>

      <ng-container *ngIf="!analyzing && !report">
        <div class="dropzone"
             [class.dragover]="isDragging"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)">
          <div class="big-icon">📁</div>
          <p class="dz-title">Drop your file here</p>
          <p class="dz-sub">or</p>
          <label class="btn-primary">
            Browse files
            <input type="file" hidden (change)="onSelect($event)"
                   accept=".csv,.xlsx,.xls,.json">
          </label>
          <p class="dz-formats">CSV · XLSX · XLS · JSON · max 25MB</p>
          <p class="dz-hint">Need a sample? Required columns: amount, merchant_category, hour_of_day, is_weekend, txn_count_1h, amount_zscore_user, device_risk_score, geo_distance_km</p>
        </div>
      </ng-container>

      <ng-container *ngIf="analyzing">
        <div class="analyzing">
          <p class="status">Analyzing <strong>{{ filename }}</strong>…</p>
          <div class="scanner"></div>
          <div class="loading-skel">
            <app-skeleton width="60%" height="22px"></app-skeleton>
            <app-skeleton width="100%" height="14px"></app-skeleton>
            <app-skeleton width="92%" height="14px"></app-skeleton>
            <app-skeleton width="88%" height="14px"></app-skeleton>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="report && !analyzing">
        <div class="result-grid">
          <div class="verdict {{ report.verdict }}">
            <span class="verdict-icon">{{ verdictIcon() }}</span>
            <div>
              <div class="verdict-main">{{ report.verdict }}</div>
              <div class="verdict-sub">Risk score {{ report.fraudRiskScore | number:'1.3-3' }} · {{ report.validity.rowCount }} rows · Analyzed in {{ report.analysisTimeMs }} ms</div>
            </div>
            <div class="verdict-actions">
              <a class="btn btn-ghost" [href]="pdfUrl()" target="_blank">
                <span>⬇</span> PDF report
              </a>
              <button class="btn btn-ghost" (click)="reset()">New file</button>
            </div>
          </div>

          <div class="cards">
            <div class="card">
              <div class="card-label">Total rows</div>
              <div class="card-value">
                <app-animated-counter [value]="report.validity.rowCount"></app-animated-counter>
              </div>
            </div>
            <div class="card block">
              <div class="card-label">Would BLOCK</div>
              <div class="card-value">
                <app-animated-counter [value]="report.actionBreakdown['BLOCK'] || 0"></app-animated-counter>
              </div>
            </div>
            <div class="card flag">
              <div class="card-label">Would FLAG</div>
              <div class="card-value">
                <app-animated-counter [value]="report.actionBreakdown['FLAG'] || 0"></app-animated-counter>
              </div>
            </div>
            <div class="card stepup">
              <div class="card-label">Step-up</div>
              <div class="card-value">
                <app-animated-counter [value]="report.actionBreakdown['STEP_UP'] || 0"></app-animated-counter>
              </div>
            </div>
            <div class="card approve">
              <div class="card-label">Approve</div>
              <div class="card-value">
                <app-animated-counter [value]="report.actionBreakdown['APPROVE'] || 0"></app-animated-counter>
              </div>
            </div>
          </div>

          <div class="panel-row">
            <div class="panel">
              <div class="panel-head"><h3>File validity</h3></div>
              <table class="kv">
                <tr><th>Format</th><td>{{ report.validity.format }}</td></tr>
                <tr><th>Size</th><td>{{ (report.validity.sizeBytes / 1024) | number:'1.0-1' }} KB</td></tr>
                <tr><th>Schema</th><td>{{ report.validity.schemaVersion }}</td></tr>
                <tr><th>Analysis time</th><td>{{ report.analysisTimeMs }} ms</td></tr>
              </table>
              <div class="warns" *ngIf="report.validity.warnings?.length">
                <h4>⚠ Warnings</h4>
                <ul><li *ngFor="let w of report.validity.warnings">{{ w }}</li></ul>
              </div>
              <div class="errs" *ngIf="report.validity.errors?.length">
                <h4>🛑 Errors</h4>
                <ul><li *ngFor="let e of report.validity.errors">{{ e }}</li></ul>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><h3>Score distribution</h3></div>
              <div class="histogram">
                <div *ngFor="let c of report.scoreHistogram; let i = index"
                     class="bar"
                     [style.height.%]="histPct(c)"
                     [style.background]="histColor(i)">
                  <span class="bar-count">{{ c }}</span>
                </div>
              </div>
              <div class="hist-axis">
                <span>0.0</span><span>0.5</span><span>1.0</span>
              </div>
            </div>
          </div>

          <div class="panel summary">
            <div class="panel-head"><h3>AI summary</h3></div>
            <p>{{ report.summary }}</p>
          </div>

          <div class="panel" *ngIf="report.anomalies?.length">
            <div class="panel-head"><h3>Meta-anomalies</h3></div>
            <div class="anomaly" *ngFor="let a of report.anomalies"
                 [class.high]="a.severity === 'high'"
                 [class.medium]="a.severity === 'medium'">
              <div class="anom-head">
                <span class="anom-type">{{ a.type }}</span>
                <span class="anom-sev">{{ a.severity }}</span>
              </div>
              <div class="anom-desc">{{ a.description }}</div>
              <div class="anom-rows" *ngIf="a.affectedRows?.length">
                Affected rows: {{ a.affectedRows.slice(0, 20).join(', ') }}{{ a.affectedRows.length > 20 ? '…' : '' }}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h3>Top suspicious rows</h3>
              <span class="muted">click any row to inspect</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Row</th><th>Txn ID</th><th>Amount</th><th>Score</th><th>Action</th><th>Top reasons</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of report.topSuspicious">
                  <td>{{ r.rowNumber }}</td>
                  <td class="mono">{{ r.transactionId }}</td>
                  <td>\${{ r.amount | number:'1.2-2' }}</td>
                  <td class="mono">{{ r.score | number:'1.3-3' }}</td>
                  <td><span class="badge" [ngClass]="'badge-' + r.action.toLowerCase()">{{ r.action }}</span></td>
                  <td class="reasons">
                    <span *ngFor="let t of r.topReasons" class="reason-pill">
                      {{ t.feature }} +{{ t.contribution | number:'1.2-2' }}
                    </span>
                    <span *ngIf="!r.topReasons?.length" class="muted">low risk</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .page { padding: 22px 28px 60px; max-width: 1200px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 6px 0; }
    .subtitle { color: var(--muted); margin-bottom: 24px; max-width: 70ch; }

    .dropzone .big-icon { font-size: 48px; margin-bottom: 8px; }
    .dz-title { font-size: 18px; font-weight: 600; margin: 4px 0; }
    .dz-sub { color: var(--muted); margin: 8px 0; }
    .dz-formats { color: var(--muted); margin-top: 18px; font-size: 12px; }
    .dz-hint { color: var(--muted); margin-top: 8px; font-size: 11px; }
    .btn-primary { display: inline-block; }

    .analyzing { background: var(--panel); padding: 28px; border-radius: 12px; border: 1px solid var(--border); }
    .status { margin: 0 0 18px; }
    .loading-skel { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; }

    .result-grid { display: grid; gap: 18px; }
    .verdict-actions { display: flex; gap: 8px; }
    .verdict-actions .btn { display: inline-flex; align-items: center; gap: 6px; }
    .verdict-actions a { text-decoration: none; }

    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
    .card-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    .card-value { font-size: 26px; font-weight: 700; margin-top: 6px; }
    .card.block   { border-color: rgba(239, 68, 68, 0.4); }
    .card.flag    { border-color: rgba(245, 158, 11, 0.4); }
    .card.stepup  { border-color: rgba(59, 130, 246, 0.4); }
    .card.approve { border-color: rgba(16, 185, 129, 0.4); }

    .panel-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
    .panel-head { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .panel h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .muted { color: var(--muted); font-size: 12px; }
    .summary p { padding: 14px 18px; line-height: 1.5; }
    table.kv th { text-align: left; color: var(--muted); padding: 6px 16px; font-size: 12px; }
    table.kv td { padding: 6px 16px; font-family: ui-monospace, monospace; font-size: 12px; }

    .histogram {
      display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px;
      align-items: end; padding: 14px 16px; height: 160px;
    }
    .histogram .bar {
      position: relative;
      min-height: 2px;
      border-radius: 4px 4px 0 0;
    }
    .bar-count {
      position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
      font-size: 10px; color: var(--muted);
    }
    .hist-axis { display: flex; justify-content: space-between; padding: 0 16px 12px; color: var(--muted); font-size: 10px; }

    .anomaly { padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .anomaly:last-child { border-bottom: 0; }
    .anom-head { display: flex; justify-content: space-between; }
    .anom-type { font-weight: 600; font-family: ui-monospace, monospace; font-size: 12px; }
    .anom-sev { text-transform: uppercase; font-size: 10px; padding: 2px 8px; border-radius: 99px; background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
    .anomaly.high .anom-sev { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
    .anom-desc { margin-top: 6px; }
    .anom-rows { color: var(--muted); font-size: 11px; margin-top: 6px; font-family: ui-monospace, monospace; }

    .reasons { display: flex; gap: 6px; flex-wrap: wrap; }
    .reason-pill {
      display: inline-block;
      background: rgba(245, 158, 11, 0.12); color: #fcd34d;
      padding: 2px 8px; border-radius: 99px; font-size: 11px; font-family: ui-monospace, monospace;
    }
    .mono { font-family: ui-monospace, monospace; font-size: 12px; }

    .warns, .errs { padding: 8px 16px 16px; }
    .warns h4, .errs h4 { margin: 8px 0; font-size: 12px; }
    .warns ul, .errs ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12px; }

    @media (max-width: 900px) {
      .cards { grid-template-columns: repeat(2, 1fr); }
      .panel-row { grid-template-columns: 1fr; }
    }
  `]
})
export class UploadComponent {
  isDragging = false;
  analyzing = false;
  filename = '';
  report?: AnalysisReport;

  constructor(private svc: UploadService) {}

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }
  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
  }
  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.upload(file);
  }
  onSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.upload(file);
  }

  private upload(file: File): void {
    this.filename = file.name;
    this.analyzing = true;
    this.report = undefined;
    this.svc.upload(file).subscribe({
      next: (r) => {
        this.report = r;
        this.analyzing = false;
      },
      error: (err) => {
        this.analyzing = false;
        alert('Upload failed: ' + (err?.message ?? err));
      }
    });
  }

  reset(): void {
    this.report = undefined;
    this.filename = '';
  }

  pdfUrl(): string {
    return this.report ? `/api/analyze/report/${this.report.fileId}/pdf` : '#';
  }

  verdictIcon(): string {
    switch (this.report?.verdict) {
      case 'CLEAN':       return '✅';
      case 'SUSPICIOUS':  return '⚠️';
      case 'FRAUDULENT':  return '🚨';
      case 'INVALID':     return '🛑';
      default:            return '❓';
    }
  }

  histPct(count: number): number {
    const max = Math.max(...(this.report?.scoreHistogram ?? [1]));
    return max === 0 ? 0 : (count / max) * 100;
  }

  histColor(i: number): string {
    // green at low scores → red at high
    const stops = [
      '#10b981', '#34d399', '#86efac', '#fde68a', '#fcd34d',
      '#fbbf24', '#fb923c', '#f97316', '#ef4444', '#dc2626'
    ];
    return stops[i] || '#fff';
  }
}
