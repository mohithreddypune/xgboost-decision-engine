import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { DecisionService } from '../services/decision.service';
import { ThemeService, Theme } from '../services/theme.service';
import { KeyboardService } from '../services/keyboard.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="brand">
        <span class="logo">X</span>
        <div>
          <h1>XGBoost Decision Engine</h1>
          <p>Autonomous fraud scoring · Sub-10ms inference · Auto-retraining</p>
        </div>
      </div>

      <nav>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/upload" routerLinkActive="active">Analyzer</a>
      </nav>

      <div class="right">
        <button class="btn-ghost theme-btn" (click)="toggleTheme()" title="Toggle theme">
          {{ themeIcon() }} {{ theme }}
        </button>
        <button class="btn-ghost theme-btn" (click)="showShortcuts()" title="Keyboard shortcuts (?)">⌨</button>
        <span class="status">
          <span class="dot" [class.live]="(connected$ | async)"></span>
          <span class="label">{{ (connected$ | async) ? 'Live' : 'Reconnecting…' }}</span>
        </span>
      </div>
    </header>
  `,
  styles: [`
    header {
      display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center;
      padding: 16px 28px; border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, var(--panel) 0%, var(--bg) 100%);
    }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      display: grid; place-items: center; font-weight: 800; font-size: 22px; color: white;
    }
    h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    p  { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
    nav { display: flex; gap: 6px; }
    nav a {
      padding: 8px 14px; border-radius: 8px; color: var(--muted); text-decoration: none;
      font-weight: 500; font-size: 13px; transition: background 150ms;
    }
    nav a:hover { background: var(--panel-2); color: var(--text); }
    nav a.active { background: var(--panel-2); color: var(--text); }
    .right { display: flex; gap: 10px; align-items: center; }
    .theme-btn { font-size: 12px; }
    .status { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--muted); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #555; }
    .dot.live { background: var(--accent); box-shadow: 0 0 12px var(--accent); }

    @media (max-width: 900px) {
      header { grid-template-columns: 1fr; gap: 12px; }
      .right { justify-content: flex-start; }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  connected$: Observable<boolean>;
  theme: Theme = 'dark';
  private sub?: Subscription;
  private kbSub?: Subscription;

  constructor(
    svc: DecisionService,
    private themeSvc: ThemeService,
    private kb: KeyboardService
  ) {
    this.connected$ = svc.connectionState();
  }

  ngOnInit(): void {
    this.sub = this.themeSvc.theme$.subscribe(t => (this.theme = t));
    this.kbSub = this.kb.events$.subscribe(e => {
      if (e === 't') this.toggleTheme();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.kbSub?.unsubscribe(); }

  toggleTheme(): void { this.themeSvc.cycle(); }

  themeIcon(): string {
    return this.theme === 'dark' ? '🌙' : this.theme === 'light' ? '☀️' : '🌓';
  }

  showShortcuts(): void {
    alert(
      'Keyboard shortcuts\n\n' +
      'g f → go to feed (dashboard)\n' +
      'g d → focus drift panel\n' +
      'g u → go to upload analyzer\n' +
      'r   → force retrain\n' +
      't   → toggle theme\n' +
      '?   → show this dialog\n' +
      'Esc → close modal'
    );
  }
}
