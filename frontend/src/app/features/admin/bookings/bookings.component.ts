import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Inject } from '@angular/core';
import { debounceTime, Subject, switchMap, tap } from 'rxjs';
import { BookingService } from '../../../services/booking.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { Booking, BOOKING_STATUSES, BookingStatus } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

/** Read-only booking details dialog for admins/operators. */
@Component({
  selector: 'app-booking-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, StatusBadgeComponent, StatusLabelPipe],
  template: `
    <h2 mat-dialog-title>Booking {{ data.booking.bookingReference }}</h2>
    <mat-dialog-content>
      <dl class="details">
        <dt>Customer</dt><dd>{{ $any(data.booking.userId)?.name }} ({{ $any(data.booking.userId)?.email }})</dd>
        <dt>Location</dt><dd>{{ $any(data.booking.parkingLocationId)?.name || '—' }}</dd>
        <dt>Slot</dt><dd>{{ data.booking.slotNumber }}</dd>
        <dt>Vehicle</dt><dd>{{ data.booking.vehicleNumber }} · {{ data.booking.vehicleType | statusLabel }} <span *ngIf="data.booking.vehicleModel">· {{ data.booking.vehicleModel }}</span></dd>
        <dt>Start</dt><dd>{{ data.booking.startTime | date:'MMM d, y HH:mm' }}</dd>
        <dt>End</dt><dd>{{ data.booking.endTime | date:'MMM d, y HH:mm' }}</dd>
        <dt>Amount</dt><dd>{{ data.booking.totalAmount | currency }} ({{ data.booking.currency }})</dd>
        <dt>Status</dt><dd><app-status-badge [status]="data.booking.bookingStatus" /> <app-status-badge [status]="data.booking.paymentStatus" /></dd>
        <dt *ngIf="data.booking.checkedInAt">Checked in</dt><dd *ngIf="data.booking.checkedInAt">{{ data.booking.checkedInAt | date:'MMM d, y HH:mm' }}</dd>
        <dt *ngIf="data.booking.checkedOutAt">Checked out</dt><dd *ngIf="data.booking.checkedOutAt">{{ data.booking.checkedOutAt | date:'MMM d, y HH:mm' }}</dd>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .details { display: grid; grid-template-columns: auto 1fr; gap: .4rem 1rem; margin: 0; }
    dt { color: var(--pe-muted); font-size: .85rem; }
    dd { margin: 0; font-size: .9rem; }
  `],
})
export class BookingDetailDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { booking: Booking }) {}
}

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule,
    MatDialogModule, StatusBadgeComponent, StatusLabelPipe,
  ],
  template: `
    <h1 class="page-title">Bookings</h1>
    <p class="page-subtitle">Monitor and manage vehicle parking reservations</p>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Reference or vehicle number" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Booking status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let s of statuses" [value]="s">{{ s | statusLabel }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Payment</mat-label>
        <mat-select [(ngModel)]="paymentFilter" (ngModelChange)="reload()">
          <mat-option value="">All</mat-option>
          <mat-option value="paid">Paid</mat-option>
          <mat-option value="pending">Pending</mat-option>
          <mat-option value="refunded">Refunded</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <div class="card">
      <table mat-table [dataSource]="bookings()" class="full-width muted-table">
        <ng-container matColumnDef="reference">
          <th mat-header-cell *matHeaderCellDef>Reference</th>
          <td mat-cell *matCellDef="let b">
            <a [routerLink]="['/bookings', b._id]">{{ b.bookingReference }}</a>
          </td>
        </ng-container>
        <ng-container matColumnDef="customer">
          <th mat-header-cell *matHeaderCellDef>Customer</th>
          <td mat-cell *matCellDef="let b">{{ $any(b.userId)?.name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="location">
          <th mat-header-cell *matHeaderCellDef>Location / Slot</th>
          <td mat-cell *matCellDef="let b">{{ $any(b.parkingLocationId)?.name || '—' }} · {{ b.slotNumber }}</td>
        </ng-container>
        <ng-container matColumnDef="vehicle">
          <th mat-header-cell *matHeaderCellDef>Vehicle</th>
          <td mat-cell *matCellDef="let b">{{ b.vehicleNumber }}</td>
        </ng-container>
        <ng-container matColumnDef="period">
          <th mat-header-cell *matHeaderCellDef>Period</th>
          <td mat-cell *matCellDef="let b" class="period">
            {{ b.startTime | date:'MMM d, HH:mm' }} → {{ b.endTime | date:'MMM d, HH:mm' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef>Amount</th>
          <td mat-cell *matCellDef="let b">{{ b.totalAmount | currency }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let b">
            <app-status-badge [status]="b.bookingStatus" />
            <app-status-badge [status]="b.paymentStatus" />
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let b">
            <button mat-icon-button matTooltip="Details" (click)="details(b)"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button matTooltip="Check in" *ngIf="b.bookingStatus === 'confirmed'" (click)="act(b, 'check-in')"><mat-icon>login</mat-icon></button>
            <button mat-icon-button matTooltip="Check out" *ngIf="b.bookingStatus === 'checked-in'" (click)="act(b, 'check-out')"><mat-icon>logout</mat-icon></button>
            <button mat-icon-button matTooltip="Cancel booking" *ngIf="b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed'" (click)="act(b, 'cancel')"><mat-icon>cancel</mat-icon></button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>

      <div *ngIf="!bookings().length" class="empty-state text-muted">No bookings match your filters.</div>

      <mat-paginator
        [length]="meta().total"
        [pageIndex]="meta().page - 1"
        [pageSize]="meta().limit"
        [pageSizeOptions]="[10, 25, 50]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; }
    .period { font-size: .8rem; white-space: nowrap; }
    .empty-state { text-align: center; padding: 2rem; }
    app-status-badge { margin-right: .3rem; }
    @media (max-width: 900px) { .filters { grid-template-columns: 1fr; } }
  `],
})
export class BookingsComponent {
  private readonly bookingService = inject(BookingService);
  private readonly notifier = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly bookings = signal<Booking[]>([]);
  readonly meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false });
  readonly search = signal('');
  readonly statuses = BOOKING_STATUSES;

  statusFilter = '';
  paymentFilter = '';
  private page = 1;
  private limit = 10;
  private readonly searchSubject = new Subject<string>();

  readonly cols = ['reference', 'customer', 'location', 'vehicle', 'period', 'amount', 'status', 'actions'];

  constructor() {
    this.searchSubject.pipe(debounceTime(350), switchMap(() => this.fetch())).subscribe();
    this.reload();
  }

  private fetch() {
    return this.bookingService.allBookings({
      page: this.page,
      limit: this.limit,
      search: this.search() || undefined,
      bookingStatus: this.statusFilter || undefined,
      paymentStatus: this.paymentFilter || undefined,
    }).pipe(
      tap({
        next: (res) => {
          this.bookings.set(res.items);
          this.meta.set(res.meta);
        },
      })
    );
  }

  reload(): void {
    this.page = 1;
    this.fetch().subscribe();
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.searchSubject.next(v);
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex + 1;
    this.limit = e.pageSize;
    this.fetch().subscribe();
  }

  details(b: Booking): void {
    this.dialog.open(BookingDetailDialogComponent, { data: { booking: b } });
  }

  async act(b: Booking, action: 'check-in' | 'check-out' | 'cancel'): Promise<void> {
    const labels = { 'check-in': 'Check in', 'check-out': 'Check out', cancel: 'Cancel' } as const;
    if (action === 'cancel') {
      const ok = await this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Cancel booking?',
          message: `${b.bookingReference} will be cancelled${b.paymentStatus === 'paid' ? ' and refunded' : ''}. The slot becomes available again.`,
          confirmLabel: 'Cancel booking',
          danger: true,
        },
      }).afterClosed().toPromise();
      if (!ok) return;
    }
    try {
      if (action === 'check-in') await this.bookingService.checkIn(b._id);
      if (action === 'check-out') await this.bookingService.checkOut(b._id);
      if (action === 'cancel') await this.bookingService.cancel(b._id);
      this.notifier.success(`${labels[action]} completed for ${b.bookingReference}`);
      this.fetch().subscribe();
    } catch {
      // interceptor shows error (e.g. invalid transition)
    }
  }
}
