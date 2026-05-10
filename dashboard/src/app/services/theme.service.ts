import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'dark' | 'light' | 'auto';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly key = 'dem-theme';
  private readonly subject = new BehaviorSubject<Theme>(this.read());

  readonly theme$ = this.subject.asObservable();

  constructor() {
    this.apply(this.subject.value);
    if (this.subject.value === 'auto') {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => this.apply('auto'));
    }
  }

  cycle(): void {
    const order: Theme[] = ['dark', 'light', 'auto'];
    const next = order[(order.indexOf(this.subject.value) + 1) % order.length];
    this.set(next);
  }

  set(t: Theme): void {
    this.apply(t);
    localStorage.setItem(this.key, t);
    this.subject.next(t);
  }

  private read(): Theme {
    const v = localStorage.getItem(this.key) as Theme | null;
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'dark';
  }

  private apply(t: Theme): void {
    let resolved: 'dark' | 'light';
    if (t === 'auto') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = t;
    }
    document.documentElement.setAttribute('data-theme', resolved);
  }
}
