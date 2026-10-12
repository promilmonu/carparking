import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatIconModule],
  template: `
    <div class="auth-shell">
      <div class="brand">
        <mat-icon>local_parking</mat-icon>
        <a routerLink="/">ParkEase</a>
      </div>
      <div class="panel card">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .auth-shell { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem; padding: 1rem; background: linear-gradient(135deg, #eef1fa, #f8f9ff); }
    .brand { display: flex; align-items: center; gap: .5rem; font-size: 1.4rem; font-weight: 700; color: var(--pe-primary); }
    .brand a { color: inherit; }
    .panel { width: 100%; max-width: 430px; padding: 2rem; }
  `],
})
export class AuthLayoutComponent {}
