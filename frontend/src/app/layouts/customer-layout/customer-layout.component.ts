import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <div class="shell">
      <mat-toolbar class="toolbar">
        <a routerLink="/" class="brand">
          <mat-icon>local_parking</mat-icon>
          <span>ParkEase</span>
        </a>
        <span class="spacer"></span>

        <nav class="nav-links">
          <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a mat-button routerLink="/parking" routerLinkActive="active">Find Parking</a>
          <a mat-button *ngIf="auth.isLoggedIn()" routerLink="/my-bookings" routerLinkActive="active">My Bookings</a>
          <a mat-button *ngIf="auth.isAdmin()" routerLink="/admin" routerLinkActive="active">Admin Panel</a>
        </nav>

        <ng-container *ngIf="!auth.isLoggedIn(); else loggedin">
          <a mat-button routerLink="/login">Login</a>
          <a mat-flat-button color="primary" routerLink="/register" class="register-btn">Sign Up</a>
        </ng-container>
        <ng-template #loggedin>
          <button mat-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
            <span class="user-name">{{ auth.user()?.name }}</span>
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/profile"><mat-icon>person</mat-icon><span>Profile</span></button>
            <button mat-menu-item routerLink="/my-bookings"><mat-icon>event_note</mat-icon><span>My Bookings</span></button>
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon><span>Logout</span></button>
          </mat-menu>
        </ng-template>
      </mat-toolbar>

      <main class="content">
        <router-outlet></router-outlet>
      </main>

      <footer class="footer">
        <span>ParkEase — Vehicle Parking Management System</span>
      </footer>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; display: flex; flex-direction: column; }
    .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid var(--pe-border); gap: .5rem; }
    .brand { display: flex; align-items: center; gap: .4rem; color: var(--pe-primary); font-weight: 700; font-size: 1.1rem; }
    .brand:hover { text-decoration: none; }
    .spacer { flex: 1; }
    .nav-links { display: flex; }
    .nav-links a.active { color: var(--pe-primary); font-weight: 600; }
    .user-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .content { flex: 1; }
    .footer { text-align: center; padding: 1rem; color: var(--pe-muted); font-size: .82rem; border-top: 1px solid var(--pe-border); background: #fff; }
    @media (max-width: 900px) {
      .nav-links { display: none; }
      .user-name { display: none; }
    }
  `],
})
export class CustomerLayoutComponent {
  readonly auth = inject(AuthService);

  async logout(): Promise<void> {
    await this.auth.logoutAndRedirect();
  }
}
