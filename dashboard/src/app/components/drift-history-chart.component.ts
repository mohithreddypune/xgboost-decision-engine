import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  Chart, LineController, LineElement, PointElement, LinearScale, TimeScale,
  CategoryScale, Filler, Tooltip, Legend
} from 'chart.js';
import { InsightsService, DriftHistory } from '../services/insights.service';

Chart.register(LineController, LineElement, PointElement, LinearScale,
               TimeScale, CategoryScale, Filler, Tooltip, Legend);

@Component({
  selector: 'app-drift-history-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>Drift trend · 24h</h2>
        <span class="muted">PSI per feature, sampled every 5 min</span>
      </div>
      <div class="chart-wrap">
        <canvas #chart></canvas>
      </div>
    </div>
  `,
  styles: [`
    .chart-wrap { padding: 14px 16px; height: 260px; }
    .muted { color: var(--muted); font-size: 12px; }
  `]
})
export class DriftHistoryChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chart') canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private sub?: Subscription;
  private latest?: DriftHistory;

  private readonly colors = [
    '#00d68f', '#06b6d4', '#a855f7', '#fbbf24',
    '#ef4444', '#3b82f6', '#f97316', '#ec4899',
  ];

  constructor(private svc: InsightsService) {}

  ngOnInit(): void {
    this.sub = this.svc.pollDriftHistory().subscribe((h) => {
      this.latest = h;
      this.update();
    });
  }

  ngAfterViewInit(): void {
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: { color: '#8995c7', boxWidth: 8, boxHeight: 8, font: { size: 11 }, usePointStyle: true }
          },
          tooltip: { backgroundColor: '#0a0e27', titleColor: '#fff', bodyColor: '#eef2ff', borderColor: '#243056', borderWidth: 1, padding: 10 }
        },
        scales: {
          x: { ticks: { color: '#5e6a99', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { beginAtZero: true, ticks: { color: '#5e6a99', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } }
        }
      }
    });
    this.update();
  }

  private update(): void {
    if (!this.chart || !this.latest) return;
    const points = this.latest.points;
    if (points.length === 0) {
      this.chart.data.labels = [];
      this.chart.data.datasets = [];
      this.chart.update();
      return;
    }
    const labels = points.map(p => new Date(p.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    const features = Object.keys(points[0].per_feature);
    const datasets = features.map((f, i) => ({
      label: f,
      data: points.map(p => p.per_feature[f]),
      borderColor: this.colors[i % this.colors.length],
      backgroundColor: this.colors[i % this.colors.length] + '15',
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
    }));
    // Threshold line
    datasets.push({
      label: `threshold (${this.latest.threshold})`,
      data: points.map(() => this.latest!.threshold),
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderDash: [4, 4],
      borderWidth: 1,
      pointRadius: 0,
      tension: 0,
      fill: false,
    } as any);
    this.chart.data.labels = labels;
    this.chart.data.datasets = datasets as any;
    this.chart.update();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.chart?.destroy();
  }
}
