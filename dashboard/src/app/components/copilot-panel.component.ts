import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InsightsService } from '../services/insights.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  rows?: Array<Record<string, any>>;
  mode?: string;
}

@Component({
  selector: 'app-copilot-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel">
      <div class="panel-head">
        <h2>
          <span class="ai-dot"></span> AI Co-Pilot
        </h2>
        <span class="muted">ask about decisions, fraud rates, anomalies</span>
      </div>

      <div class="messages" #scroll>
        <div *ngFor="let m of messages" class="msg" [class.user]="m.role === 'user'">
          <div class="bubble">
            <div class="text">{{ m.text }}</div>
            <div class="badge-mode" *ngIf="m.mode">{{ m.mode }}</div>
            <ng-container *ngIf="m.rows && m.rows.length > 0">
              <table class="rows-table">
                <tr *ngFor="let r of m.rows!.slice(0, 5)">
                  <td class="mono">{{ r['transactionId'] }}</td>
                  <td>\${{ r['amount'] | number:'1.2-2' }}</td>
                  <td class="mono">{{ r['score'] | number:'1.3-3' }}</td>
                  <td>{{ r['action'] }}</td>
                </tr>
              </table>
              <div class="more" *ngIf="m.rows!.length > 5">+ {{ m.rows!.length - 5 }} more</div>
            </ng-container>
          </div>
        </div>
        <div *ngIf="loading" class="msg">
          <div class="bubble thinking">
            <span class="dot1"></span><span class="dot2"></span><span class="dot3"></span>
          </div>
        </div>
      </div>

      <div class="input-row">
        <input
          [(ngModel)]="question"
          (keyup.enter)="ask()"
          placeholder="e.g., 'blocked transactions over $1000 in the last hour'"
          class="input"
          [disabled]="loading"
        />
        <button class="btn btn-primary" (click)="ask()" [disabled]="loading || !question.trim()">Ask</button>
      </div>

      <div class="suggestions" *ngIf="messages.length === 0">
        <button class="chip" (click)="suggest($event)">What's the current fraud rate?</button>
        <button class="chip" (click)="suggest($event)">Blocked transactions over $1000</button>
        <button class="chip" (click)="suggest($event)">What's happening right now?</button>
      </div>
    </div>
  `,
  styles: [`
    .panel { display: flex; flex-direction: column; height: 100%; min-height: 400px; }
    h2 { display: flex; align-items: center; gap: 8px; }
    .ai-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--gradient-violet);
      box-shadow: 0 0 8px var(--violet);
    }
    .muted { color: var(--muted); font-size: 12px; }
    .messages {
      flex: 1; overflow-y: auto; padding: 14px 18px;
      display: flex; flex-direction: column; gap: 12px; min-height: 220px;
    }
    .msg { display: flex; }
    .msg.user { justify-content: flex-end; }
    .bubble {
      max-width: 80%;
      background: var(--panel-2); border-radius: var(--radius-md);
      padding: 10px 14px; font-size: 13px; line-height: 1.5;
    }
    .msg.user .bubble {
      background: var(--gradient-success); color: #021a10;
    }
    .text { white-space: pre-wrap; }
    .badge-mode {
      display: inline-block; margin-top: 6px; padding: 2px 8px;
      background: rgba(168, 85, 247, 0.15); color: #d8b4fe; border-radius: 99px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .rows-table { width: 100%; margin-top: 8px; }
    .rows-table td { padding: 4px 6px; font-size: 11px; border-bottom: 1px solid var(--border); }
    .mono { font-family: var(--font-mono); }
    .more { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .thinking { display: inline-flex; gap: 4px; padding: 12px 14px; }
    .thinking span {
      width: 6px; height: 6px; border-radius: 50%; background: var(--muted);
      animation: bounce 1.4s var(--ease) infinite;
    }
    .dot2 { animation-delay: 0.2s; }
    .dot3 { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    .input-row {
      display: flex; gap: 8px; padding: 12px 16px;
      border-top: 1px solid var(--border);
    }
    .input {
      flex: 1; padding: 10px 14px; border-radius: var(--radius);
      border: 1px solid var(--border-strong); background: var(--panel-2);
      color: var(--text); font-size: 13px; font-family: inherit;
      transition: all var(--duration) var(--ease);
    }
    .input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0, 214, 143, 0.15); }

    .suggestions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 16px 16px; }
    .chip {
      background: transparent; border: 1px solid var(--border-strong); color: var(--muted);
      padding: 6px 10px; border-radius: 999px; font-size: 11px; cursor: pointer;
      transition: all var(--duration) var(--ease); font-family: inherit;
    }
    .chip:hover { color: var(--text); border-color: var(--accent); }
  `]
})
export class CopilotPanelComponent implements OnInit {
  question = '';
  messages: ChatMessage[] = [];
  loading = false;

  constructor(private svc: InsightsService) {}

  ngOnInit(): void {}

  suggest(e: Event): void {
    this.question = (e.target as HTMLElement).innerText;
    this.ask();
  }

  ask(): void {
    const q = this.question.trim();
    if (!q || this.loading) return;
    this.messages.push({ role: 'user', text: q });
    this.question = '';
    this.loading = true;
    this.svc.askCopilot(q).subscribe({
      next: (r) => {
        this.messages.push({ role: 'assistant', text: r.answer, rows: r.rows, mode: r.mode });
        this.loading = false;
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => {
        this.messages.push({ role: 'assistant', text: 'Sorry, something went wrong.' });
        this.loading = false;
      }
    });
  }

  private scrollToBottom(): void {
    const el = document.querySelector('.messages');
    if (el) el.scrollTop = el.scrollHeight;
  }
}
