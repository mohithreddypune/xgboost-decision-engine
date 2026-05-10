import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

/**
 * Animates a number from its previous value to the new one over `duration`ms.
 * Lightweight CountUp.js replacement — no extra dependency.
 */
@Component({
  selector: 'app-animated-counter',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `<span>{{ display | number:'1.0-0' }}</span>`
})
export class AnimatedCounterComponent implements OnChanges {
  @Input() value = 0;
  @Input() duration = 700;
  display = 0;
  private rafId?: number;

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes) this.animate(this.display, this.value);
  }

  private animate(from: number, to: number): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / this.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.display = Math.round(from + (to - from) * eased);
      if (t < 1) this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
