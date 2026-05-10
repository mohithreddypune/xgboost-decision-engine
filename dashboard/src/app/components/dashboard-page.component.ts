import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsPanelComponent } from './stats-panel.component';
import { FeedComponent } from './feed.component';
import { DriftPanelComponent } from './drift-panel.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, StatsPanelComponent, FeedComponent, DriftPanelComponent],
  template: `
    <app-stats-panel></app-stats-panel>
    <main>
      <div class="left"><app-feed></app-feed></div>
      <div class="right"><app-drift-panel></app-drift-panel></div>
    </main>
  `,
  styles: [`
    main {
      display: grid; grid-template-columns: 1.6fr 1fr;
      gap: 18px; padding: 18px 28px;
    }
    @media (max-width: 1100px) {
      main { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardPageComponent {}
