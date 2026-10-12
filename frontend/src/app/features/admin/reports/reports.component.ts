import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { AdminService } from '../../../services/admin.service';
import { OccupancyReport, RevenueReport } from '../../../core/models';
import { BarChartComponent, BarDatum } from '../../../shared/components/bar-chart/bar-chart.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, BarChartComponent,
  ],
  template: `
    <h1 class="page-title">Reports</h1>
    <p class="page-subtitle">Occupancy and revenue analytics</p>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Occupancy range</mat-label>
        <mat-select [(ngModel)]="days" (ngModelChange)="loadOccupancy()">
          <mat-option [value]="7">Last 7 days</mat-option>
          <mat-option [value]="14">Last 14 days</mat-option>
          <mat-option [value]="30">Last 30 days</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Revenue from</mat-label>
        <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="from" (dateChange)="loadRevenue()" />
        <mat-datepicker-toggle matSuffix [for]="pickerFrom"></mat-datepicker-toggle>
        <mat-datepicker #pickerFrom></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Revenue to</mat-label>
        <input matInput [matDatepicker]="pickerTo" [(ngModel)]="to" (dateChange)="loadRevenue()" />
        <mat-datepicker-toggle matSuffix [for]="pickerTo"></mat-datepicker-toggle>
        <mat-datepicker #pickerTo></mat-datepicker>
      </mat-form-field>
    </div>

    <div class="grid gap-2 mb-2" style="grid-template-columns: 1fr 1fr;">
      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Occupancy (%)</mat-card-title>
          <mat-card-subtitle>Bookings per day vs capacity ({{ occupancy()?.capacity ?? 0 }} slots)</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-bar-chart [data]="occupancyChart()" [maxValue]="100"></app-bar-chart>
        </mat-card-content>
      </mat-card>

      <mat-card class="card">
        <mat-card-header>
          <mat-card-title>Revenue</mat-card-title>
          <mat-card-subtitle>Total: {{ revenue()?.totalRevenue | currency }} across {{ revenue()?.totalPayments ?? 0 }} payments</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-bar-chart [data]="revenueChart()"></app-bar-chart>
        </mat-card-content>
      </mat-card>
    </div>

    <mat-card class="card">
      <mat-card-header><mat-card-title>Revenue by location</mat-card-title></mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="revenue()?.perLocation ?? []" class="full-width muted-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Location</th>
            <td mat-cell *matCellDef="let r">{{ r.locationName || 'Unknown' }}</td>
          </ng-container>
          <ng-container matColumnDef="payments">
            <th mat-header-cell *matHeaderCellDef>Payments</th>
            <td mat-cell *matCellDef="let r">{{ r.payments }}</td>
          </ng-container>
          <ng-container matColumnDef="revenue">
            <th mat-header-cell *matHeaderCellDef>Revenue</th>
            <td mat-cell *matCellDef="let r"><strong>{{ r.revenue | currency }}</strong></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['name', 'payments', 'revenue']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['name', 'payments', 'revenue'];"></tr>
        </table>
        <p *ngIf="!revenue()?.perLocation?.length" class="text-muted">No paid bookings in this period.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
    @media (max-width: 900px) { .grid[style], .filters { grid-template-columns: 1fr !important; } }
  `],
})
export class ReportsComponent {
  private readonly admin = inject(AdminService);

  readonly occupancy = signal<OccupancyReport | null>(null);
  readonly revenue = signal<RevenueReport | null>(null);
  readonly occupancyChart = signal<BarDatum[]>([]);
  readonly revenueChart = signal<BarDatum[]>([]);

  days = 7;
  from: Date | null = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  to: Date | null = new Date();

  ngOnInit(): void {
    this.loadOccupancy();
    this.loadRevenue();
  }

  loadOccupancy(): void {
    this.admin.occupancyReport(this.days).subscribe({
      next: (report) => {
        this.occupancy.set(report);
        this.occupancyChart.set(
          report.days.map((d) => ({ label: d.date.slice(5), value: d.occupancyPercent, display: `${d.occupancyPercent}%` }))
        );
      },
    });
  }

  loadRevenue(): void {
    const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
    this.admin.revenueReport({ from: iso(this.from), to: iso(this.to) }).subscribe({
      next: (report) => {
        this.revenue.set(report);
        this.revenueChart.set(
          report.perDay.map((d) => ({ label: d.date.slice(5), value: d.revenue, display: `₹${Math.round(d.revenue)}` }))
        );
      },
    });
  }
}
