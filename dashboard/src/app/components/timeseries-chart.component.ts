import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend
} from 'chart.js';
import { InsightsService, Timeseries } from '../services/insights.service';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'app-timeseries-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>Decision rate · {{ minutes }} min</h2>
        <div class="ctrls">
          <button class="chip" [class.active]="minutes === 15" (click)="set(15)">15m</button>
          <button class="chip" [class.active]="minutes === 60" (click)="set(60)">60m</button>
          <button class="chip" [class.active]="minutes === 360" (click)="set(360)">6h</button>
        </div>
      </div>
      <div class="chart-wrap">
        <canvas #chart></canvas>
      </div>
    </div>
  `,
  styles: [`
    .chart-wrap { padding: 14px 16px; height: 220px; }
    .ctrls { display: flex; gap: 6px; }
    .chip {
      background: transparent; border: 1px solid var(--border); color: var(--muted);
      padding: 4px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
      transition: all var(--duration) var(--ease); font-family: inherit;
    }
    .chip:hover  { color: var(--text); border-color: var(--border-strong); }
    .chip.active { background: var(--gradient-success); color: #021a10; border-color: transparent; font-weight: 600; }
  `]
})
export class TimeseriesChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart') canvas!: ElementRef<HTMLCanvasElement>;
  minutes = 60;
  private chart?: Chart;
  private sub?: Subscription;

  constructor(private svc: InsightsService) {}

  ngOnInit(): void { this.subscribe(); }

  ngAfterViewInit(): void {
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: { color: '#8995c7', boxWidth: 8, boxHeight: 8, font: { size: 11 }, usePointStyle: true }
          },
          tooltip: { backgroundColor: '#0a0e27', titleColor: '#fff', bodyColor: '#eef2ff', borderColor: '#243056', borderWidth: 1, padding: 10 }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#5e6a99', font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: '#5e6a99', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } }
        }
      }
    });
  }

  set(m: number): void {
    this.minutes = m;
    this.sub?.unsubscribe();
    this.subscribe();
  }

  private subscribe(): void {
    this.sub = this.svc.pollTimeseries(this.minutes).subscribe(ts => this.render(ts));
  }

  private render(ts: Timeseries): void {
    if (!this.chart) return;
    const labels = ts.buckets.map(b => new Date(b.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    this.chart.data.labels = labels;
    this.chart.data.datasets = [
      { label: 'APPROVE',  data: ts.buckets.map(b => b.APPROVE),  backgroundColor: '#00d68f' },
      { label: 'STEP_UP',  data: ts.buckets.map(b => b.STEP_UP),  backgroundColor: '#3b82f6' },
      { label: 'FLAG',     data: ts.buckets.map(b => b.FLAG),     backgroundColor: '#fbbf24' },
      { label: 'BLOCK',    data: ts.buckets.map(b => b.BLOCK),    backgroundColor: '#ef4444' },
    ] as any;
    this.chart.update();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.chart?.destroy(); }
}
