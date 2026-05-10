import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      <div *ngFor="let t of toasts; trackBy: trackById"
           class="toast"
           [class.warning]="t.severity === 'warning'"
           [class.error]="t.severity === 'error'"
           [class.info]="t.severity === 'info'">
        <span class="icon">{{ t.severity === 'error' ? '🚨' : t.severity === 'warning' ? '⚠️' : 'ℹ️' }}</span>
        <div>
          <div class="title">{{ t.title }}</div>
          <div class="body" *ngIf="t.body">{{ t.body }}</div>
        </div>
        <button class="close" (click)="dismiss(t.id)" aria-label="Dismiss">✕</button>
      </div>
    </div>
  `
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub?: Subscription;
  constructor(private svc: ToastService) {}
  ngOnInit(): void { this.sub = this.svc.toasts$.subscribe(t => (this.toasts = t)); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  dismiss(id: number): void { this.svc.dismiss(id); }
  trackById(_: number, t: Toast): number { return t.id; }
}
