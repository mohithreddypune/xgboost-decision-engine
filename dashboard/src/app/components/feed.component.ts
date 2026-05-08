import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { DecisionService } from '../services/decision.service';
import { DecisionEvent } from '../models/decision';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>Live decision feed</h2>
        <span class="muted">Streaming via STOMP/WebSocket</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Txn ID</th>
            <th>Amount</th>
            <th>Score</th>
            <th>Action</th>
            <th>Latency</th>
            <th>Model</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let e of items; trackBy: trackById"
              [class.flash]="e.id === justAddedId">
            <td>{{ e.createdAt | date:'HH:mm:ss' }}</td>
            <td class="mono">{{ e.transactionId }}</td>
            <td>\${{ e.amount | number:'1.2-2' }}</td>
            <td class="mono">{{ e.score | number:'1.3-3' }}</td>
            <td><span class="badge" [ngClass]="'badge-' + e.action.toLowerCase()">{{ e.action }}</span></td>
            <td>{{ e.latencyMs | number:'1.1-1' }} ms</td>
            <td class="muted mono">{{ e.modelVersion }}</td>
          </tr>
          <tr *ngIf="items.length === 0">
            <td colspan="7" class="empty">Waiting for decisions… start the simulator: <code>docker compose --profile simulate up simulator</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
    .panel-head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    h2 { margin: 0; font-size: 14px; font-weight: 600; }
    .muted { color: var(--muted); font-size: 12px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .empty { color: var(--muted); text-align: center; padding: 28px; }
    @keyframes flashRow {
      0%   { background: rgba(16,185,129,0.18); }
      100% { background: transparent; }
    }
    tr.flash { animation: flashRow 1s ease-out; }
  `]
})
export class FeedComponent implements OnInit, OnDestroy {
  items: DecisionEvent[] = [];
  justAddedId: number | null = null;
  private feedSub?: Subscription;

  constructor(private svc: DecisionService) {}

  ngOnInit(): void {
    this.svc.recent().subscribe(rows => (this.items = rows));
    this.feedSub = this.svc.decisionFeed().subscribe(e => {
      this.items = [e, ...this.items].slice(0, 100);
      this.justAddedId = e.id;
    });
  }

  trackById(_: number, e: DecisionEvent): number { return e.id; }

  ngOnDestroy(): void { this.feedSub?.unsubscribe(); }
}
