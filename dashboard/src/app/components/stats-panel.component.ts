import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { DecisionService } from '../services/decision.service';
import { ActionStats } from '../models/decision';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="grid">
      <div class="card">
        <div class="card-label">Decisions / 60 min</div>
        <div class="card-value">{{ stats?.totalDecisions ?? 0 }}</div>
      </div>
      <div class="card block">
        <div class="card-label">Blocked</div>
        <div class="card-value">{{ stats?.counts?.['BLOCK'] ?? 0 }}</div>
      </div>
      <div class="card flag">
        <div class="card-label">Flagged</div>
        <div class="card-value">{{ stats?.counts?.['FLAG'] ?? 0 }}</div>
      </div>
      <div class="card stepup">
        <div class="card-label">Step-up</div>
        <div class="card-value">{{ stats?.counts?.['STEP_UP'] ?? 0 }}</div>
      </div>
      <div class="card approve">
        <div class="card-label">Approved</div>
        <div class="card-value">{{ stats?.counts?.['APPROVE'] ?? 0 }}</div>
      </div>
    </section>
  `,
  styles: [`
    .grid {
      display: grid; gap: 14px;
      grid-template-columns: repeat(5, 1fr);
      padding: 18px 28px 0;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 0 rgba(255,255,255,0.03);
    }
    .card-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    .card-value { font-size: 28px; font-weight: 700; margin-top: 6px; }
    .card.block   { border-color: rgba(239, 68, 68, 0.4); }
    .card.flag    { border-color: rgba(245, 158, 11, 0.4); }
    .card.stepup  { border-color: rgba(59, 130, 246, 0.4); }
    .card.approve { border-color: rgba(16, 185, 129, 0.4); }
  `]
})
export class StatsPanelComponent implements OnInit, OnDestroy {
  stats?: ActionStats;
  private sub?: Subscription;

  constructor(private svc: DecisionService) {}

  ngOnInit(): void {
    this.sub = interval(8000)
      .pipe(startWith(0), switchMap(() => this.svc.stats(60)))
      .subscribe(s => (this.stats = s));
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
