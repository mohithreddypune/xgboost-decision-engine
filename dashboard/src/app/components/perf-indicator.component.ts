import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { InsightsService, PerfStats } from '../services/insights.service';

@Component({
  selector: 'app-perf-indicator',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="perf" [class.warn]="warn" [class.danger]="danger" *ngIf="stats">
      <span class="dot" [class.live-dot]="!warn && !danger"></span>
      <span class="label">p99</span>
      <span class="value">{{ stats.p99_ms | number:'1.1-1' }}<span class="unit">ms</span></span>
    </div>
  `,
  styles: [`
    .perf {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 5px 10px; border-radius: 999px;
      background: rgba(0, 214, 143, 0.08); border: 1px solid rgba(0, 214, 143, 0.22);
      font-size: 12px; transition: all var(--duration) var(--ease);
    }
    .perf.warn   { background: rgba(251, 191, 36, 0.10); border-color: rgba(251, 191, 36, 0.32); }
    .perf.danger { background: rgba(239, 68, 68, 0.10); border-color: rgba(239, 68, 68, 0.32); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
    .perf.warn .dot   { background: var(--warn); }
    .perf.danger .dot { background: var(--danger); }
    .label { color: var(--muted); font-weight: 500; }
    .value { font-family: var(--font-mono); font-weight: 600; color: var(--text); }
    .unit  { color: var(--muted-2); margin-left: 2px; font-size: 11px; }
  `]
})
export class PerfIndicatorComponent implements OnInit, OnDestroy {
  stats?: PerfStats;
  warn = false;
  danger = false;
  private sub?: Subscription;

  constructor(private svc: InsightsService) {}

  ngOnInit(): void {
    this.sub = this.svc.pollPerf().subscribe(s => {
      this.stats = s;
      this.warn   = s.p99_ms > 20;
      this.danger = s.p99_ms > 50;
    });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
