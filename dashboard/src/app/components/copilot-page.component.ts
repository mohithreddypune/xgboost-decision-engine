import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CopilotPanelComponent } from './copilot-panel.component';

@Component({
  selector: 'app-copilot-page',
  standalone: true,
  imports: [CommonModule, CopilotPanelComponent],
  template: `
    <main>
      <div class="head">
        <h2 class="title">AI Co-Pilot</h2>
        <p class="subtitle">Ask natural-language questions about decisions, fraud rates, and the live stream. Local mode runs out of the box; LLM mode activates when you set <code>COPILOT_API_KEY</code>.</p>
      </div>
      <app-copilot-panel></app-copilot-panel>
    </main>
  `,
  styles: [`
    main { padding: 22px 28px 60px; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
    .head { padding: 0 4px; }
    .title { font-size: 24px; font-weight: 700; margin: 0; letter-spacing: -0.022em; }
    .subtitle { color: var(--muted); margin: 8px 0 0; max-width: 70ch; }
    code { font-family: var(--font-mono); background: var(--panel-2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  `]
})
export class CopilotPageComponent {}
