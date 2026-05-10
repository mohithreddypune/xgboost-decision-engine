import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `<div class="skeleton" [style.width]="width" [style.height]="height"></div>`
})
export class SkeletonComponent {
  @Input() width = '100%';
  @Input() height = '14px';
}
