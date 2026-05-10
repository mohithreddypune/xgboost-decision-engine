import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Minimal vim-style hotkey service. Sequences (e.g. "g f") are recognized
 * within a 600ms window. Single keys are emitted immediately.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private readonly seq$ = new Subject<string>();
  readonly events$ = this.seq$.asObservable();
  private buffer = '';
  private bufferTimer?: number;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    if (this.shouldIgnore(e)) return;
    const key = this.normalize(e);
    if (!key) return;

    // Special instant keys
    if (key === 'Escape' || key === '?' || key === '/') {
      this.seq$.next(key);
      this.buffer = '';
      return;
    }

    // Build sequence
    this.buffer = (this.buffer + ' ' + key).trim();
    if (this.bufferTimer) window.clearTimeout(this.bufferTimer);
    // Emit longer sequences if recognized
    const recognized = ['g f', 'g d', 'g u'];
    if (recognized.includes(this.buffer)) {
      this.seq$.next(this.buffer);
      this.buffer = '';
      return;
    }
    // Single-letter shortcuts
    const single = ['r', 't'];
    if (single.includes(key) && !this.buffer.includes(' ')) {
      this.bufferTimer = window.setTimeout(() => {
        if (this.buffer === key) this.seq$.next(key);
        this.buffer = '';
      }, 200);
    } else {
      this.bufferTimer = window.setTimeout(() => (this.buffer = ''), 600);
    }
  }

  private normalize(e: KeyboardEvent): string {
    if (e.key === 'Escape') return 'Escape';
    if (e.key === '?') return '?';
    if (e.key === '/') return '/';
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) return e.key.toLowerCase();
    return '';
  }

  private shouldIgnore(e: KeyboardEvent): boolean {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
  }
}
