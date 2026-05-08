import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DecisionService } from '../services/decision.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header>
      <div class="brand">
        <span class="logo">X</span>
        <div>
          <h1>XGBoost Decision Engine</h1>
          <p>Autonomous fraud scoring · Sub-10ms inference · Auto-retraining</p>
        </div>
      </div>
      <div class="status">
        <span class="dot" [class.live]="(connected$ | async)"></span>
        <span class="label">{{ (connected$ | async) ? 'Live' : 'Reconnecting…' }}</span>
      </div>
    </header>
  `,
  styles: [`
    header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 28px; border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, #0e1530 0%, #0b1020 100%);
    }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: linear-gradient(135deg, #10b981, #06d6a0);
      display: grid; place-items: center; font-weight: 800; font-size: 22px; color: white;
    }
    h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    p  { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
    .status { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--muted); }
    .dot {
      width: 10px; height: 10px; border-radius: 50%; background: #555;
    }
    .dot.live { background: var(--accent); box-shadow: 0 0 12px var(--accent); }
  `]
})
export class HeaderComponent {
  connected$: Observable<boolean>;

  constructor(svc: DecisionService) {
    this.connected$ = svc.connectionState();
  }
}
