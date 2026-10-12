import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../../../services/admin.service';
import { BookingService } from '../../../services/booking.service';
import { ParkingService } from '../../../services/parking.service';
import { DashboardStats, Booking, ParkingLocation } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { BarChartComponent, BarDatum } from '../../../shared/components/bar-chart/bar-chart.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatTableModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, StatusBadgeComponent, BarChartComponent, StatusLabelPipe,
  ],
  template: `
    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle" style="margin:0">Parking operations at a glance</p>
      </div>
      <a mat-flat-button color="primary" routerLink="/admin/locations/new">
        <mat-icon>add</mat-icon> Add Parking Location
      </a>
    </div>

    <mat-spinner *ngIf="loading()" class="center-spinner"></mat-spinner>

    <ng-container *ngIf="stats() as s">
      <div class="grid grid-4 mb-2">
        <div class="card stat">
          <span class="stat-icon" style="background:#e8eaf6;color:#3f51b5"><mat-icon>location_on</mat-icon></span>
          <div><span class="stat-value">{{ s.totalLocations }}</span><span class="stat-label">Parking Locations</span></div>
        </div>
        <div class="card stat">
          <span class="stat-icon" style="background:#e8f5e9;color:#2e7d32"><mat-icon>grid_view</mat-icon></span>
          <div><span class="stat-value">{{ s.totalSlots }}</span><span class="stat-label">Total Slots</span></div>
        </div>
        <div class="card stat">
          <span class="stat-icon" style="background:#e1f5fe;color:#0277bd"><mat-icon>check_circle</mat-icon></span>
          <div><span class="stat-value">{{ s.availableSlots }}</span><span class="stat-label">Available Slots</span></div>
        </div>
        <div class="card stat">
          <span class="stat-icon" style="background:#fff3e0;color:#ef6c00"><mat-icon>local_parking</mat-icon></span>
          <div><span class="stat-value">{{ s.occupiedSlots }}</span><span class="stat-label">Occupied Slots</span></div>
        </div>
        <div class="card stat">
          <span class="stat-icon" style="background:#f3e5f5;color:#7b1fa2"><mat-icon>event_note</mat-icon></span>
          <div><span class="stat-value">{{ s.activeBookings }}</span><span class="stat-label">Active Bookings</span></div>
        </div>
        <div class="card stat">
          <span class="stat-icon" style="background:#e8f5e9;color:#2e7d32"><mat-icon>payments</mat-icon></span>
          <div><span class="stat-value">{{ s.todayRevenue | currency }}</span><span class="stat-label">Today's Revenue</span></div>
        </div>
      </div>

      <div class="grid gap-2 mb-2" style="grid-template-columns: 2fr 1fr;">
        <mat-card class="card">
          <mat-card-header>
            <mat-card-title>Occupancy — last 7 days (%)</mat-card-title>
            <mat-card-subtitle>Bookings vs. total capacity</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <app-bar-chart [data]="occupancyChart()" [maxValue]="100"></app-bar-chart>
          </mat-card-content>
        </mat-card>

        <mat-card class="card">
          <mat-card-header><mat-card-title>Recently Added Locations</mat-card-title></mat-card-header>
          <mat-card-content>
            <ul class="recent-list">
              <li *ngFor="let loc of recentLocations()">
                <a [routerLink]="['/admin/slots', loc._id]">{{ loc.name }}</a>
                <span class="text-muted">{{ loc.city }} · {{ loc.code }} · <app-status-badge [status]="loc.isActive ? 'active' : 'inactive'" /></span>
              </li>
              <li *ngIf="!recentLocations().length" class="text-muted">No locations yet.</li>
            </ul>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Recent Bookings</mat-card-title>
          <a mat-button routerLink="/admin/bookings" class="view-all">View all</a>
        </mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="recentBookings()" class="full-width muted-table">
            <ng-container matColumnDef="reference">
              <th mat-header-cell *matHeaderCellDef>Reference</th>
              <td mat-cell *matCellDef="let b">{{ b.bookingReference }}</td>
            </ng-container>
            <ng-container matColumnDef="location">
              <th mat-header-cell *matHeaderCellDef>Location</th>
              <td mat-cell *matCellDef="let b">{{ $any(b.parkingLocationId)?.name || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="slot">
              <th mat-header-cell *matHeaderCellDef>Slot</th>
              <td mat-cell *matCellDef="let b">{{ b.slotNumber }}</td>
            </ng-container>
            <ng-container matColumnDef="vehicle">
              <th mat-header-cell *matHeaderCellDef>Vehicle</th>
              <td mat-cell *matCellDef="let b">{{ b.vehicleNumber }} <span class="text-muted">({{ b.vehicleType | statusLabel }})</span></td>
            </ng-container>
            <ng-container matColumnDef="when">
              <th mat-header-cell *matHeaderCellDef>Start</th>
              <td mat-cell *matCellDef="let b">{{ b.startTime | date:'MMM d, HH:mm' }}</td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let b">{{ b.totalAmount | currency }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let b"><app-status-badge [status]="b.bookingStatus" /></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="bookingCols"></tr>
            <tr mat-row *matRowDef="let row; columns: bookingCols;"></tr>
          </table>
          <p *ngIf="!recentBookings().length" class="text-muted">No bookings yet.</p>
        </mat-card-content>
      </mat-card>
    </ng-container>
  `,
  styles: [`
    .stat { display: flex; gap: .9rem; align-items: center; }
    .stat-icon { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; flex: none; }
    .stat-value { display: block; font-size: 1.35rem; font-weight: 700; line-height: 1.1; }
    .stat-label { color: var(--pe-muted); font-size: .78rem; }
    .recent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .75rem; }
    .recent-list li { display: flex; flex-direction: column; gap: .15rem; font-size: .9rem; }
    .center-spinner { margin: 3rem auto; }
    .view-all { margin-left: auto; }
    @media (max-width: 900px) { .grid[style] { grid-template-columns: 1fr !important; } }
  `],
})
export class DashboardComponent {
  private readonly admin = inject(AdminService);
  private readonly parking = inject(ParkingService);
  private readonly bookingsService = inject(BookingService);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly recentBookings = signal<Booking[]>([]);
  readonly recentLocations = signal<ParkingLocation[]>([]);

  readonly bookingCols = ['reference', 'location', 'slot', 'vehicle', 'when', 'amount', 'status'];

  readonly occupancyChart = signal<BarDatum[]>([]);

  ngOnInit(): void {
    this.admin.dashboard().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.occupancyChart.set(
          (stats.occupancy?.days ?? []).map((d) => ({
            label: d.date.slice(5),
            value: d.occupancyPercent,
            display: `${d.occupancyPercent}%`,
          }))
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.parking.listLocations({ limit: 4, sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (res) => this.recentLocations.set(res.items),
    });

    this.bookingsService.allBookings({ limit: 6, sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (res) => this.recentBookings.set(res.items),
    });
  }
}
