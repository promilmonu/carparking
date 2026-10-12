import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { debounceTime, Subject, switchMap, tap } from 'rxjs';
import { ParkingService } from '../../../services/parking.service';
import { NotificationService } from '../../../services/notification.service';
import { ParkingLocation, PARKING_TYPES } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-admin-location-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, MatDialogModule, StatusBadgeComponent, StatusLabelPipe,
  ],
  template: `
    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
      <div>
        <h1 class="page-title">Parking Locations</h1>
        <p class="page-subtitle" style="margin:0">Add, edit and monitor parking locations</p>
      </div>
      <a mat-flat-button color="primary" routerLink="/admin/locations/new">
        <mat-icon>add</mat-icon> Add Location
      </a>
    </div>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Name, code, city or address" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>City</mat-label>
        <input matInput [ngModel]="city()" (ngModelChange)="city.set($event); reload()" />
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Type</mat-label>
        <mat-select [ngModel]="parkingType()" (ngModelChange)="parkingType.set($event); reload()">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let t of parkingTypes" [value]="t">{{ t | statusLabel }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [ngModel]="activeFilter()" (ngModelChange)="activeFilter.set($event); reload()">
          <mat-option value="">All</mat-option>
          <mat-option value="true">Active</mat-option>
          <mat-option value="false">Inactive</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <div class="card">
      <table mat-table [dataSource]="locations()" class="full-width muted-table" matSort (matSortChange)="onSort($event)">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Location</th>
          <td mat-cell *matCellDef="let l">
            <strong>{{ l.name }}</strong><br/><span class="text-muted">{{ l.code }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="city">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>City</th>
          <td mat-cell *matCellDef="let l">{{ l.city }}, {{ l.state }}</td>
        </ng-container>
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let l">{{ l.parkingType | statusLabel }}</td>
        </ng-container>
        <ng-container matColumnDef="capacity">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Capacity</th>
          <td mat-cell *matCellDef="let l">{{ l.totalCapacity }}</td>
        </ng-container>
        <ng-container matColumnDef="slots">
          <th mat-header-cell *matHeaderCellDef>Slots (free/total)</th>
          <td mat-cell *matCellDef="let l">
            <span class="slots-pill">{{ l.availableSlots ?? 0 }} / {{ l.totalSlots ?? 0 }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="rates">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Rates</th>
          <td mat-cell *matCellDef="let l">{{ l.hourlyRate | currency }}/hr · {{ l.dailyRate | currency }}/day</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let l"><app-status-badge [status]="l.isActive ? 'active' : 'inactive'" /></td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let l">
            <a mat-icon-button matTooltip="Manage slots" [routerLink]="['/admin/slots', l._id]"><mat-icon>grid_view</mat-icon></a>
            <a mat-icon-button matTooltip="Edit" [routerLink]="['/admin/locations', l._id, 'edit']"><mat-icon>edit</mat-icon></a>
            <button mat-icon-button [matTooltip]="l.isActive ? 'Deactivate' : 'Activate'" (click)="toggleStatus(l)">
              <mat-icon>{{ l.isActive ? 'toggle_off' : 'toggle_on' }}</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Delete" (click)="delete(l)"><mat-icon>delete</mat-icon></button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>

      <div *ngIf="!loading() && !locations().length" class="empty-state text-muted">
        No parking locations match your filters.
      </div>

      <mat-paginator
        [length]="meta().total"
        [pageIndex]="meta().page - 1"
        [pageSize]="meta().limit"
        [pageSizeOptions]="[5, 10, 25, 50]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; }
    .slots-pill { background: #eef1fa; border-radius: 999px; padding: .15rem .6rem; font-size: .8rem; font-weight: 600; color: #3949ab; }
    .empty-state { text-align: center; padding: 2rem; }
    @media (max-width: 900px) { .filters { grid-template-columns: 1fr 1fr; } }
  `],
})
export class AdminLocationListComponent {
  private readonly parking = inject(ParkingService);
  private readonly notifier = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly parkingTypes = PARKING_TYPES;
  readonly locations = signal<ParkingLocation[]>([]);
  readonly loading = signal(true);
  readonly meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false });

  readonly search = signal('');
  readonly city = signal('');
  readonly parkingType = signal('');
  readonly activeFilter = signal('');

  private page = 1;
  private limit = 10;
  private sortBy = 'name';
  private sortOrder: 'asc' | 'desc' = 'asc';
  private readonly searchSubject = new Subject<string>();

  readonly cols = ['name', 'city', 'type', 'capacity', 'slots', 'rates', 'status', 'actions'];

  constructor() {
    this.searchSubject
      .pipe(debounceTime(350), switchMap((q) => this.fetch(q)))
      .subscribe();
    this.reload();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchSubject.next(value);
  }

  private fetch(searchValue = this.search()) {
    this.loading.set(true);
    return this.parking.listLocations({
      page: this.page,
      limit: this.limit,
      search: searchValue || undefined,
      city: this.city() || undefined,
      parkingType: this.parkingType() || undefined,
      isActive: this.activeFilter() ? this.activeFilter() === 'true' : undefined,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder,
    }).pipe(
      tap({
        next: (res) => {
          this.locations.set(res.items);
          this.meta.set(res.meta);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      })
    );
  }

  reload(): void {
    this.page = 1;
    this.fetch().subscribe({ error: () => {} });
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex + 1;
    this.limit = e.pageSize;
    this.fetch().subscribe({ error: () => {} });
  }

  onSort(e: Sort): void {
    if (!e.active) return;
    this.sortBy = e.active;
    this.sortOrder = e.direction === 'desc' ? 'desc' : 'asc';
    this.fetch().subscribe({ error: () => {} });
  }

  async toggleStatus(loc: ParkingLocation): Promise<void> {
    const confirmed = await this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: loc.isActive ? 'Deactivate location?' : 'Activate location?',
        message: loc.isActive
          ? `"${loc.name}" will disappear from customer search until reactivated.`
          : `"${loc.name}" will become visible and bookable by customers.`,
        confirmLabel: loc.isActive ? 'Deactivate' : 'Activate',
        danger: loc.isActive,
      },
    }).afterClosed().toPromise();

    if (!confirmed) return;
    try {
      await this.parking.setLocationStatus(loc._id, !loc.isActive);
      this.notifier.success(`Location ${loc.isActive ? 'deactivated' : 'activated'}`);
      this.fetch().subscribe({ error: () => {} });
    } catch {
      // interceptor shows the error
    }
  }

  async delete(loc: ParkingLocation): Promise<void> {
    const confirmed = await this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete parking location?',
        message: `This permanently removes "${loc.name}" and its slots. Locations with active bookings cannot be deleted.`,
        confirmLabel: 'Delete',
        danger: true,
      },
    }).afterClosed().toPromise();

    if (!confirmed) return;
    try {
      await this.parking.deleteLocation(loc._id);
      this.notifier.success('Parking location deleted');
      this.fetch().subscribe({ error: () => {} });
    } catch {
      // interceptor shows the error
    }
  }
}
