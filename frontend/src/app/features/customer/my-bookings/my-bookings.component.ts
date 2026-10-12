import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { tap } from 'rxjs';
import { BookingService } from '../../../services/booking.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { Booking } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatTableModule, MatPaginatorModule, MatButtonModule,
    MatIconModule, MatButtonToggleModule, MatTooltipModule, MatDialogModule, StatusBadgeComponent,
  ],
  template: `
    <div class="wrap">
      <h1 class="page-title">My Bookings</h1>
      <p class="page-subtitle">Track, pay, cancel and check in from here.</p>

      <mat-button-toggle-group class="mb-2" [(ngModel)]="scope" (ngModelChange)="reload()">
        <mat-button-toggle value="all">All</mat-button-toggle>
        <mat-button-toggle value="current">Current</mat-button-toggle>
        <mat-button-toggle value="past">Past</mat-button-toggle>
      </mat-button-toggle-group>

      <div class="card">
        <table mat-table [dataSource]="bookings()" class="full-width muted-table">
          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef>Reference</th>
            <td mat-cell *matCellDef="let b">
              <a [routerLink]="['/bookings', b._id]">{{ b.bookingReference }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="location">
            <th mat-header-cell *matHeaderCellDef>Location</th>
            <td mat-cell *matCellDef="let b">
              {{ $any(b.parkingLocationId)?.name || '—' }}<br/>
              <span class="text-muted">Slot {{ b.slotNumber }}</span>
            </td>
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
              <button mat-icon-button *ngIf="b.bookingStatus === 'pending'" matTooltip="Pay & confirm" (click)="pay(b)">
                <mat-icon>payments</mat-icon>
              </button>
              <button mat-icon-button *ngIf="b.bookingStatus === 'confirmed'" matTooltip="Check in" (click)="checkIn(b)">
                <mat-icon>login</mat-icon>
              </button>
              <button mat-icon-button *ngIf="b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed'" matTooltip="Cancel" (click)="cancel(b)">
                <mat-icon>cancel</mat-icon>
              </button>
              <a mat-icon-button matTooltip="Details" [routerLink]="['/bookings', b._id]">
                <mat-icon>visibility</mat-icon>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols;"></tr>
        </table>

        <div *ngIf="!bookings().length" class="empty-state text-muted">
          No bookings here yet. <a routerLink="/parking">Find parking</a> to get started.
        </div>

        <mat-paginator
          [length]="meta().total"
          [pageIndex]="meta().page - 1"
          [pageSize]="meta().limit"
          [pageSizeOptions]="[5, 10, 25]"
          (page)="onPage($event)">
        </mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .wrap { max-width: 1200px; margin: 1.5rem auto 3rem; padding: 0 1rem; }
    .period { font-size: .82rem; white-space: nowrap; }
    .empty-state { text-align: center; padding: 2.5rem; }
    app-status-badge { margin-right: .3rem; }
  `],
})
export class MyBookingsComponent {
  private readonly bookingService = inject(BookingService);
  private readonly notifier = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly bookings = signal<Booking[]>([]);
  readonly meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false });

  scope: 'all' | 'current' | 'past' = 'all';
  private page = 1;
  private limit = 10;

  readonly cols = ['reference', 'location', 'period', 'amount', 'status', 'actions'];

  ngOnInit(): void {
    this.reload();
  }

  private fetch() {
    return this.bookingService.myBookings({ page: this.page, limit: this.limit, scope: this.scope }).pipe(
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
    this.fetch().subscribe({ error: () => {} });
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex + 1;
    this.limit = e.pageSize;
    this.fetch().subscribe({ error: () => {} });
  }

  async pay(b: Booking): Promise<void> {
    try {
      await this.bookingService.confirm(b._id, 'upi');
      this.notifier.success('Payment successful — booking confirmed');
      this.fetch().subscribe();
    } catch {
      // interceptor shows error
    }
  }

  async checkIn(b: Booking): Promise<void> {
    try {
      await this.bookingService.checkIn(b._id);
      this.notifier.success('Checked in — enjoy your visit');
      this.fetch().subscribe();
    } catch {
      // interceptor shows error
    }
  }

  async cancel(b: Booking): Promise<void> {
    const ok = await this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel booking?',
        message: `${b.bookingReference} will be cancelled${b.paymentStatus === 'paid' ? ' and your payment refunded' : ''}.`,
        confirmLabel: 'Cancel booking',
        danger: true,
      },
    }).afterClosed().toPromise();
    if (!ok) return;
    try {
      await this.bookingService.cancel(b._id);
      this.notifier.success('Booking cancelled');
      this.fetch().subscribe();
    } catch {
      // interceptor shows error
    }
  }
}
