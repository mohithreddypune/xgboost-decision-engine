import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  severity: 'info' | 'warning' | 'error';
  title: string;
  body?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private next = 1;
  private readonly subject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.subject.asObservable();

  push(t: Omit<Toast, 'id'>, ttlMs = 6000): void {
    const toast: Toast = { id: this.next++, ...t };
    this.subject.next([...this.subject.value, toast]);
    if (ttlMs > 0) setTimeout(() => this.dismiss(toast.id), ttlMs);
  }

  dismiss(id: number): void {
    this.subject.next(this.subject.value.filter(t => t.id !== id));
  }
}
