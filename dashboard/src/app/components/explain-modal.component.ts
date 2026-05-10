import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ExplainService, Explanation } from '../services/explain.service';
import { SkeletonComponent } from './skeleton.component';

@Component({
  selector: 'app-explain-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe, SkeletonComponent],
  template: `
    <div class="modal-backdrop" *ngIf="decisionId" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="head">
          <h3>Why was this decision made?</h3>
          <button class="close" (click)="close.emit()">✕</button>
        </div>

        <ng-container *ngIf="loading">
          <div class="block"><app-skeleton height="20px"></app-skeleton></div>
          <div class="block"><app-skeleton height="80px"></app-skeleton></div>
          <div class="block"><app-skeleton height="220px"></app-skeleton></div>
        </ng-container>

        <ng-container *ngIf="!loading && exp">
          <div class="score-row">
            <span class="label">Model score</span>
            <span class="big">{{ exp.score | number:'1.3-3' }}</span>
            <span class="muted">model: {{ exp.modelVersion }}</span>
          </div>

          <div class="narrative">{{ exp.narrative }}</div>

          <div class="contrib-section">
            <h4>Feature contributions</h4>
            <p class="muted">Positive bars push toward FRAUD. Negative bars push toward CLEAN.</p>
            <div class="bar-list">
              <div *ngFor="let c of sorted()" class="bar-row">
                <div class="bar-label">{{ c.feature }} = {{ c.value | number:'1.0-3' }}</div>
                <div class="bar-track">
                  <div class="bar"
                       [class.pos]="c.contribution > 0"
                       [class.neg]="c.contribution < 0"
                       [style.width.%]="abs(c.contribution) / maxAbs * 50"
                       [style.left.%]="c.contribution > 0 ? 50 : 50 - (abs(c.contribution) / maxAbs * 50)">
                  </div>
                  <div class="midline"></div>
                </div>
                <div class="bar-value">{{ c.contribution > 0 ? '+' : '' }}{{ c.contribution | number:'1.3-3' }}</div>
              </div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .close { background: transparent; border: 0; color: var(--muted); cursor: pointer; font-size: 18px; }
    .block { padding: 14px 20px; }
    .score-row { display: flex; gap: 14px; align-items: baseline; padding: 18px 20px 8px; }
    .score-row .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .score-row .big { font-size: 28px; font-weight: 700; }
    .muted { color: var(--muted); font-size: 12px; }
    .narrative { padding: 0 20px 16px; line-height: 1.5; }
    .contrib-section { padding: 16px 20px; border-top: 1px solid var(--border); }
    h4 { margin: 0 0 4px; font-size: 13px; }
    .bar-list { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: 180px 1fr 80px; gap: 10px; align-items: center; font-size: 12px; }
    .bar-label { color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { position: relative; height: 12px; background: var(--panel-2); border-radius: 6px; overflow: hidden; }
    .bar { position: absolute; top: 0; bottom: 0; }
    .bar.pos { background: linear-gradient(90deg, var(--warn), var(--danger)); }
    .bar.neg { background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
    .midline { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: var(--border); }
    .bar-value { font-family: ui-monospace, monospace; text-align: right; }
  `]
})
export class ExplainModalComponent implements OnChanges {
  @Input() decisionId: number | null = null;
  @Output() close = new EventEmitter<void>();

  loading = false;
  exp?: Explanation;
  maxAbs = 1;

  constructor(private svc: ExplainService) {}

  ngOnChanges(): void {
    if (this.decisionId == null) {
      this.exp = undefined;
      return;
    }
    this.loading = true;
    this.svc.forDecision(this.decisionId).subscribe({
      next: (e) => {
        this.exp = e;
        this.maxAbs = Math.max(0.0001,
          ...e.contributions.map(c => Math.abs(c.contribution)));
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  abs(n: number): number { return Math.abs(n); }

  sorted(): Explanation['contributions'] {
    if (!this.exp) return [];
    return [...this.exp.contributions].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
    );
  }
}
