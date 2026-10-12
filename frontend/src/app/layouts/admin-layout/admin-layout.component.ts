import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map, asyncScheduler, throttleTime } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule,
  ],
  template: `
    <mat-sidenav-container class="admin-shell">
      <mat-sidenav
        class="sidenav"
        [mode]="isWide() ? 'side' : 'over'"
        [opened]="isWide() ? true : sidenavOpen"
        (closedStart)="sidenavOpen = false">
        <div class="brand">
          <mat-icon>local_parking</mat-icon>
          <span>ParkEase <small>Admin</small></span>
        </div>
        <mat-nav-list>
          <a mat-list-item *ngFor="let item of navItems" [routerLink]="item.path" routerLinkActive="active"
             (click)="closeOnMobile()">
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        </mat-nav-list>
        <div class="sidenav-footer">
          <a mat-list-item (click)="logout()">
            <mat-icon matListItemIcon>logout</mat-icon>
            <span matListItemTitle>Logout</span>
          </a>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="content">
        <mat-toolbar class="toolbar">
          <button mat-icon-button (click)="sidenavOpen = !sidenavOpen" *ngIf="!isWide()">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
            {{ auth.user()?.name }}
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item routerLink="/admin/settings">
              <mat-icon>settings</mat-icon><span>Settings</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon><span>Logout</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="page">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .admin-shell { height: 100vh; }
    .sidenav { width: 250px; display: flex; flex-direction: column; }
    .brand { display: flex; align-items: center; gap: .6rem; padding: 1.1rem 1rem; font-weight: 700; font-size: 1.05rem; color: var(--pe-primary); }
    .brand small { color: var(--pe-muted); font-weight: 500; }
    mat-nav-list { flex: 1; }
    a[mat-list-item].active { background: #eef1fa; color: var(--pe-primary); font-weight: 600; }
    .sidenav-footer { border-top: 1px solid var(--pe-border); padding: .4rem 0; }
    .content { display: flex; flex-direction: column; background: var(--pe-bg); }
    .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid var(--pe-border); }
    .spacer { flex: 1; }
    .page { padding: 1.5rem; max-width: 1400px; width: 100%; margin: 0 auto; }
    @media (max-width: 640px) { .page { padding: 1rem; } }
  `],
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);

  sidenavOpen = false;

  readonly isWide = toSignal(
    this.breakpoint.observe('(min-width: 1024px)').pipe(map((s) => s.matches), throttleTime(0, asyncScheduler, { leading: true, trailing: true })),
    { initialValue: true }
  );

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', path: '/admin' },
    { label: 'Parking Locations', icon: 'location_on', path: '/admin/locations' },
    { label: 'Parking Slots', icon: 'grid_view', path: '/admin/slots' },
    { label: 'Bookings', icon: 'event_note', path: '/admin/bookings' },
    { label: 'Customers', icon: 'people', path: '/admin/customers' },
    { label: 'Operators', icon: 'badge', path: '/admin/operators' },
    { label: 'Payments', icon: 'payments', path: '/admin/payments' },
    { label: 'Reports', icon: 'insights', path: '/admin/reports' },
    { label: 'Settings', icon: 'settings', path: '/admin/settings' },
  ];

  closeOnMobile(): void {
    if (!this.isWide()) this.sidenavOpen = false;
  }

  async logout(): Promise<void> {
    await this.auth.logoutAndRedirect();
  }
}
