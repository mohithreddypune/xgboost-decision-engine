import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { InsightsService, MapDecision } from '../services/insights.service';

const ACTION_COLOR: Record<MapDecision['action'], string> = {
  BLOCK:   '#ef4444',
  FLAG:    '#fbbf24',
  STEP_UP: '#3b82f6',
  APPROVE: '#00d68f',
};

@Component({
  selector: 'app-transaction-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>Live transaction map</h2>
        <div class="legend">
          <span class="leg block">BLOCK</span>
          <span class="leg flag">FLAG</span>
          <span class="leg stepup">STEP_UP</span>
          <span class="leg approve">APPROVE</span>
        </div>
      </div>
      <div class="map-wrap" #map></div>
    </div>
  `,
  styles: [`
    .map-wrap { height: 360px; border-bottom-left-radius: var(--radius-md); border-bottom-right-radius: var(--radius-md); overflow: hidden; }
    .legend { display: flex; gap: 8px; }
    .leg {
      font-size: 10px; font-weight: 700; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px;
      display: inline-flex; align-items: center; gap: 4px;
    }
    .leg::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
    .leg.block::before   { background: #ef4444; }
    .leg.flag::before    { background: #fbbf24; }
    .leg.stepup::before  { background: #3b82f6; }
    .leg.approve::before { background: #00d68f; }
    .leg.block   { color: #fca5a5; background: rgba(239, 68, 68, 0.10); }
    .leg.flag    { color: #fcd34d; background: rgba(245, 158, 11, 0.10); }
    .leg.stepup  { color: #93c5fd; background: rgba(59, 130, 246, 0.10); }
    .leg.approve { color: #6ee7b7; background: rgba(0, 214, 143, 0.10); }
  `]
})
export class TransactionMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('map') mapEl!: ElementRef<HTMLDivElement>;
  private map?: L.Map;
  private markers: L.CircleMarker[] = [];
  private sub?: Subscription;
  private seen = new Set<number>();

  constructor(private svc: InsightsService) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [20, 0], zoom: 2, worldCopyJump: true,
      attributionControl: true, zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: 'OpenStreetMap'
    }).addTo(this.map);

    this.sub = this.svc.pollMapRecent().subscribe(rows => this.render(rows));
  }

  private render(rows: MapDecision[]): void {
    if (!this.map) return;
    for (const r of rows) {
      if (this.seen.has(r.id)) continue;
      this.seen.add(r.id);
      const color = ACTION_COLOR[r.action];
      const radius = r.action === 'BLOCK' ? 8 : r.action === 'FLAG' ? 6 : 4;
      const m = L.circleMarker([r.lat, r.lon], {
        radius, color, fillColor: color, fillOpacity: 0.75, weight: 1.5
      }).addTo(this.map);
      m.bindPopup(
        `<div style="font-family: Inter, sans-serif; font-size: 12px;">
           <div style="font-weight:600; margin-bottom:4px;">${r.city || ''}</div>
           <div>Action: <strong style="color:${color}">${r.action}</strong></div>
           <div>Amount: $${r.amount.toFixed(2)}</div>
           <div>Score: ${r.score.toFixed(3)}</div>
           <div style="color:#888; margin-top:4px;">${new Date(r.createdAt).toLocaleTimeString()}</div>
         </div>`,
        { closeButton: false }
      );
      this.markers.push(m);
    }
    // Cap markers visible
    while (this.markers.length > 300) {
      const old = this.markers.shift();
      if (old) old.remove();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.map?.remove();
  }
}
