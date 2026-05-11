import { Routes } from '@angular/router';
import { DashboardPageComponent } from './components/dashboard-page.component';
import { UploadComponent } from './components/upload.component';
import { CopilotPageComponent } from './components/copilot-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardPageComponent },
  { path: 'upload', component: UploadComponent },
  { path: 'copilot', component: CopilotPageComponent },
  { path: '**', redirectTo: 'dashboard' }
];
