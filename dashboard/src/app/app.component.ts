import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderComponent } from './components/header.component';
import { ToastContainerComponent } from './components/toast-container.component';
import { ThemeService } from './services/theme.service';
import { KeyboardService } from './services/keyboard.service';
import { DecisionService } from './services/decision.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, ToastContainerComponent],
  template: `
    <app-header></app-header>
    <router-outlet></router-outlet>
    <app-toasts></app-toasts>
    <footer>
      <span>XGBoost · Spring Boot · Kafka · Postgres · Angular 17</span>
    </footer>
  `,
  styles: [`
    footer {
      padding: 18px 28px; color: var(--muted); border-top: 1px solid var(--border); font-size: 12px;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  private kbSub?: Subscription;

  constructor(
    private router: Router,
    _theme: ThemeService,        // ensure constructed early
    private kb: KeyboardService,
    private decisions: DecisionService
  ) {}

  ngOnInit(): void {
    this.kbSub = this.kb.events$.subscribe(e => {
      if (e === 'g f') this.router.navigateByUrl('/dashboard');
      else if (e === 'g u') this.router.navigateByUrl('/upload');
      else if (e === 'g d') this.router.navigateByUrl('/dashboard');
      else if (e === 'r') this.decisions.triggerRetrain().subscribe();
    });
  }

  ngOnDestroy(): void { this.kbSub?.unsubscribe(); }
}
