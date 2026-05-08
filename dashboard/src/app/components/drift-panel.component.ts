import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title
} from 'chart.js';
import { DecisionService } from '../services/decision.service';
import { DriftReport } from '../models/decision';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

@Component({
  selector: 'app-drift-panel',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>Model drift (PSI)</h2>
        <div class="row">
          <span class="muted" *ngIf="report">samples: {{ report.samples }} · threshold: {{ report.threshold }}</span>
          <button class="retrain-btn" (click)="onRetrain()">Force retrain</button>
        </div>
      </div>

      <div class="status" [class.alert]="report?.drifted">
        <strong>{{ report?.drifted ? 'DRIFT DETECTED' : 'Model healthy' }}</strong>
        <span>max PSI = {{ report?.max_psi ?? 0 | number:'1.3-3' }}</span>
      </div>

      <div class="chart-wrap">
        <canvas #chart></canvas>
      </div>
    </div>
  `,
  styles: [`
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
    .panel-head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    h2 { margin: 0; font-size: 14px; font-weight: 600; }
    .row { display: flex; gap: 12px; align-items: center; }
    .muted { color: var(--muted); font-size: 12px; }
    .retrain-btn {
      background: var(--accent); color: #062012; border: 0; border-radius: 6px;
      padding: 6px 10px; font-weight: 600; cursor: pointer;
    }
    .status {
      display: flex; gap: 18px; align-items: baseline;
      padding: 14px 16px; border-bottom: 1px solid var(--border);
      color: var(--muted);
    }
    .status strong { color: var(--accent); }
    .status.alert strong { color: var(--danger); }
    .chart-wrap { padding: 14px 16px; height: 240px; }
  `]
})
export class DriftPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart') canvas!: ElementRef<HTMLCanvasElement>;
  report?: DriftReport;
  private chartObj?: Chart;
  private sub?: Subscription;

  constructor(private svc: DecisionService) {}

  ngOnInit(): void {
    this.sub = this.svc.pollDrift().subscribe(r => {
      this.report = r;
      this.updateChart();
    });
  }

  ngAfterViewInit(): void {
    this.chartObj = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'PSI', data: [], backgroundColor: '#10b981' }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#93a4d1' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { beginAtZero: true, ticks: { color: '#93a4d1' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  onRetrain(): void {
    this.svc.triggerRetrain().subscribe();
  }

  private updateChart(): void {
    if (!this.chartObj || !this.report) return;
    const labels = Object.keys(this.report.per_feature);
    const data = labels.map(k => this.report!.per_feature[k]);
    const colors = data.map(v => (v >= (this.report!.threshold) ? '#ef4444' : '#10b981'));
    this.chartObj.data.labels = labels;
    this.chartObj.data.datasets[0].data = data;
    (this.chartObj.data.datasets[0] as any).backgroundColor = colors;
    this.chartObj.update();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.chartObj?.destroy();
  }
}
