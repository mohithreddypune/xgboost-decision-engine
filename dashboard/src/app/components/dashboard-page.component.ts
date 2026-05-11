import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsPanelComponent } from './stats-panel.component';
import { FeedComponent } from './feed.component';
import { DriftPanelComponent } from './drift-panel.component';
import { DriftHistoryChartComponent } from './drift-history-chart.component';
import { TimeseriesChartComponent } from './timeseries-chart.component';
import { TransactionMapComponent } from './transaction-map.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule, StatsPanelComponent, FeedComponent, DriftPanelComponent,
    DriftHistoryChartComponent, TimeseriesChartComponent, TransactionMapComponent
  ],
  template: `
    <app-stats-panel></app-stats-panel>
    <main>
      <div class="row">
        <app-timeseries-chart class="col-2"></app-timeseries-chart>
        <app-drift-panel class="col-1"></app-drift-panel>
      </div>
      <div class="row">
        <app-drift-history-chart class="col-2"></app-drift-history-chart>
        <app-transaction-map class="col-1"></app-transaction-map>
      </div>
      <div class="row">
        <app-feed class="col-full"></app-feed>
      </div>
    </main>
  `,
  styles: [`
    main { padding: 18px 28px 32px; display: flex; flex-direction: column; gap: 18px; }
    .row { display: grid; gap: 18px; grid-template-columns: 2fr 1fr; }
    .col-full { grid-column: 1 / -1; }
    @media (max-width: 1100px) {
      .row { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardPageComponent {}
