import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header.component';
import { StatsPanelComponent } from './components/stats-panel.component';
import { FeedComponent } from './components/feed.component';
import { DriftPanelComponent } from './components/drift-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HeaderComponent, StatsPanelComponent, FeedComponent, DriftPanelComponent],
  template: `
    <app-header></app-header>
    <app-stats-panel></app-stats-panel>
    <main>
      <div class="left"><app-feed></app-feed></div>
      <div class="right"><app-drift-panel></app-drift-panel></div>
    </main>
    <footer>
      <span>XGBoost · Spring Boot · Kafka · Postgres · Angular 17</span>
    </footer>
  `,
  styles: [`
    main {
      display: grid; grid-template-columns: 1.6fr 1fr;
      gap: 18px; padding: 18px 28px;
    }
    @media (max-width: 1100px) {
      main { grid-template-columns: 1fr; }
    }
    footer {
      padding: 18px 28px; color: var(--muted); border-top: 1px solid var(--border); font-size: 12px;
    }
  `]
})
export class AppComponent {}
