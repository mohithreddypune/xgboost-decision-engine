import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { DecisionService } from '../services/decision.service';
import { ActionStats } from '../models/decision';
import { AnimatedCounterComponent } from './animated-counter.component';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, AnimatedCounterComponent],
  template: `
    <section class="grid">
      <div class="card primary">
        <div class="card-icon">⊞</div>
        <div>
          <div class="card-label">Decisions / 60 min</div>
          <div class="card-value">
            <app-animated-counter [value]="stats?.totalDecisions ?? 0"></app-animated-counter>
          </div>
        </div>
      </div>
      <div class="card block">
        <div class="card-icon">⛔</div>
        <div>
          <div class="card-label">Blocked</div>
          <div class="card-value">
            <app-animated-counter [value]="stats?.counts?.['BLOCK'] ?? 0"></app-animated-counter>
          </div>
        </div>
      </div>
      <div class="card flag">
        <div class="card-icon">⚑</div>
        <div>
          <div class="card-label">Flagged</div>
          <div class="card-value">
            <app-animated-counter [value]="stats?.counts?.['FLAG'] ?? 0"></app-animated-counter>
          </div>
        </div>
      </div>
      <div class="card stepup">
        <div class="card-icon">↻</div>
        <div>
          <div class="card-label">Step-up</div>
          <div class="card-value">
            <app-animated-counter [value]="stats?.counts?.['STEP_UP'] ?? 0"></app-animated-counter>
          </div>
        </div>
      </div>
      <div class="card approve">
        <div class="card-icon">✓</div>
        <div>
          <div class="card-label">Approved</div>
          <div class="card-value">
            <app-animated-counter [value]="stats?.counts?.['APPROVE'] ?? 0"></app-animated-counter>
          </div>
        </div>
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
      backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px 18px;
      display: flex; gap: 14px; align-items: center;
      transition: all var(--duration) var(--ease);
      position: relative; overflow: hidden;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
      opacity: 0.4;
    }
    .card:hover { transform: translateY(-2px); border-color: var(--border-strong); box-shadow: var(--shadow-md); }

    .card-icon {
      width: 40px; height: 40px; border-radius: var(--radius);
      display: grid; place-items: center;
      font-size: 18px; font-weight: 600;
      background: var(--panel-2);
      flex-shrink: 0;
    }
    .card-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 500; }
    .card-value { font-size: 26px; font-weight: 700; margin-top: 2px; line-height: 1.1; letter-spacing: -0.02em; }

    .card.primary  .card-icon { background: linear-gradient(135deg, rgba(0,214,143,0.15), rgba(6,182,212,0.10)); color: #6ee7b7; }
    .card.primary::before { background: linear-gradient(90deg, transparent, rgba(0, 214, 143, 0.5), transparent); }
    .card.block    { border-color: rgba(239, 68, 68, 0.25); }
    .card.block .card-icon    { background: rgba(239, 68, 68, 0.12); color: #fca5a5; }
    .card.block::before       { background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent); }
    .card.flag     { border-color: rgba(251, 191, 36, 0.25); }
    .card.flag .card-icon     { background: rgba(251, 191, 36, 0.12); color: #fcd34d; }
    .card.flag::before        { background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.5), transparent); }
    .card.stepup   { border-color: rgba(59, 130, 246, 0.25); }
    .card.stepup .card-icon   { background: rgba(59, 130, 246, 0.12); color: #93c5fd; }
    .card.stepup::before      { background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent); }
    .card.approve  { border-color: rgba(0, 214, 143, 0.25); }
    .card.approve .card-icon  { background: rgba(0, 214, 143, 0.12); color: #6ee7b7; }
    .card.approve::before     { background: linear-gradient(90deg, transparent, rgba(0, 214, 143, 0.5), transparent); }

    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px)  { .grid { grid-template-columns: 1fr; } }
  `]
})
export class StatsPanelComponent implements OnInit, OnDestroy {
  stats?: ActionStats;
  private sub?: Subscription;
  constructor(private svc: DecisionService) {}
  ngOnInit(): void {
    this.sub = interval(8000).pipe(startWith(0), switchMap(() => this.svc.stats(60)))
      .subscribe(s => (this.stats = s));
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
