import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { DecisionService } from '../services/decision.service';
import { ThemeService, Theme } from '../services/theme.service';
import { KeyboardService } from '../services/keyboard.service';
import { PerfIndicatorComponent } from './perf-indicator.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, PerfIndicatorComponent],
  template: `
    <header>
      <div class="brand">
        <div class="logo-wrap">
          <div class="logo">X</div>
          <div class="logo-glow"></div>
        </div>
        <div>
          <h1 class="gradient-text">XGBoost Decision Engine</h1>
          <p class="tagline">Autonomous fraud scoring · Sub-10ms inference · Auto-retraining</p>
        </div>
      </div>

      <nav>
        <a routerLink="/dashboard" routerLinkActive="active">
          <span class="nav-icon">⊞</span>Dashboard
        </a>
        <a routerLink="/upload" routerLinkActive="active">
          <span class="nav-icon">↑</span>Analyzer
        </a>
        <a routerLink="/copilot" routerLinkActive="active">
          <span class="nav-icon">✦</span>Co-Pilot
        </a>
      </nav>

      <div class="right">
        <app-perf-indicator></app-perf-indicator>
        <button class="btn-icon" (click)="toggleTheme()" [title]="'Theme: ' + theme">
          {{ themeIcon() }}
        </button>
        <button class="btn-icon" (click)="showShortcuts()" title="Keyboard shortcuts (?)">⌨</button>
        <span class="status">
          <span class="dot" [class.live-dot]="(connected$ | async)"></span>
          <span class="label">{{ (connected$ | async) ? 'Live' : 'Reconnecting…' }}</span>
        </span>
      </div>
    </header>
  `,
  styles: [`
    header {
      display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center;
      padding: 14px 28px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(20, 26, 56, 0.6) 0%, transparent 100%);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      position: sticky; top: 0; z-index: 50;
    }
    .brand { display: flex; gap: 14px; align-items: center; }
    .logo-wrap { position: relative; }
    .logo {
      width: 42px; height: 42px; border-radius: 12px;
      background: var(--gradient-brand);
      display: grid; place-items: center;
      font-weight: 800; font-size: 22px; color: white; letter-spacing: -0.04em;
      box-shadow: 0 8px 24px rgba(0, 214, 143, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      position: relative; z-index: 1;
    }
    .logo-glow {
      position: absolute; inset: -4px; border-radius: 16px;
      background: var(--gradient-brand); opacity: 0.4;
      filter: blur(12px); z-index: 0;
    }
    h1 { margin: 0; font-size: 16px; font-weight: 700; }
    .tagline { margin: 2px 0 0; color: var(--muted); font-size: 11px; font-weight: 500; }

    nav { display: flex; gap: 4px; justify-self: center; }
    nav a {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: var(--radius);
      color: var(--muted); text-decoration: none;
      font-weight: 500; font-size: 13px;
      transition: all var(--duration) var(--ease);
      position: relative;
    }
    nav a:hover { background: var(--panel-2); color: var(--text); }
    nav a.active {
      background: var(--panel-2); color: var(--text);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    nav a.active::before {
      content: ''; position: absolute; bottom: -1px; left: 14px; right: 14px; height: 2px;
      background: var(--gradient-brand); border-radius: 2px;
    }
    .nav-icon { font-size: 14px; opacity: 0.85; }

    .right { display: flex; gap: 10px; align-items: center; }
    .status { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--muted); padding: 5px 12px; background: var(--panel-2); border-radius: 999px; border: 1px solid var(--border); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #555; }

    @media (max-width: 1100px) {
      header { grid-template-columns: 1fr; gap: 12px; padding: 12px 20px; }
      nav { justify-self: stretch; }
      .right { flex-wrap: wrap; }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  connected$: Observable<boolean>;
  theme: Theme = 'dark';
  private sub?: Subscription;
  private kbSub?: Subscription;

  constructor(svc: DecisionService, private themeSvc: ThemeService, private kb: KeyboardService) {
    this.connected$ = svc.connectionState();
  }

  ngOnInit(): void {
    this.sub = this.themeSvc.theme$.subscribe(t => (this.theme = t));
    this.kbSub = this.kb.events$.subscribe(e => { if (e === 't') this.toggleTheme(); });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); this.kbSub?.unsubscribe(); }

  toggleTheme(): void { this.themeSvc.cycle(); }
  themeIcon(): string {
    return this.theme === 'dark' ? '🌙' : this.theme === 'light' ? '☀' : '🌓';
  }
  showShortcuts(): void {
    alert(
      'Keyboard shortcuts\n\n' +
      'g f → dashboard\n' +
      'g u → analyzer\n' +
      'g c → co-pilot\n' +
      'r   → force retrain\n' +
      't   → cycle theme\n' +
      '?   → show this dialog\n' +
      'Esc → close modal'
    );
  }
}
