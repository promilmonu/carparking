import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BookingService } from '../../../services/booking.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { Booking } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

/** Booking detail page for customers (and admins via link). */
@Component({
  selector: 'app-booking-details',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule, StatusBadgeComponent, StatusLabelPipe],
  template: `
    <div class="wrap">
      <a routerLink="/my-bookings" class="back"><mat-icon>arrow_back</mat-icon> Back to my bookings</a>
      <mat-spinner *ngIf="loading()" class="center-spinner"></mat-spinner>

      <ng-container *ngIf="booking() as b">
        <div class="card">
          <div class="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h1 class="page-title">{{ b.bookingReference }}</h1>
              <span class="text-muted">Created {{ b.createdAt | date:'MMM d, y HH:mm' }}</span>
            </div>
            <div class="flex gap-1">
              <app-status-badge [status]="b.bookingStatus" />
              <app-status-badge [status]="b.paymentStatus" />
            </div>
          </div>
        </div>

        <div class="grid gap-2 mt-2" style="grid-template-columns: 1fr 1fr;">
          <div class="card">
            <h3>Parking</h3>
            <div class="row"><span>Location</span><strong>{{ $any(b.parkingLocationId)?.name || '—' }}</strong></div>
            <div class="row"><span>Address</span><strong>{{ $any(b.parkingLocationId)?.address || '—' }}</strong></div>
            <div class="row"><span>Slot</span><strong>{{ b.slotNumber }}</strong></div>
            <div class="row"><span>Start</span><strong>{{ b.startTime | date:'MMM d, y HH:mm' }}</strong></div>
            <div class="row"><span>End</span><strong>{{ b.endTime | date:'MMM d, y HH:mm' }}</strong></div>
            <div class="row" *ngIf="b.checkedInAt"><span>Checked in</span><strong>{{ b.checkedInAt | date:'MMM d, y HH:mm' }}</strong></div>
            <div class="row" *ngIf="b.checkedOutAt"><span>Checked out</span><strong>{{ b.checkedOutAt | date:'MMM d, y HH:mm' }}</strong></div>
          </div>

          <div class="card">
            <h3>Vehicle &amp; payment</h3>
            <div class="row"><span>Registration</span><strong>{{ b.vehicleNumber }}</strong></div>
            <div class="row"><span>Type</span><strong>{{ b.vehicleType | statusLabel }}</strong></div>
            <div class="row" *ngIf="b.vehicleModel"><span>Model</span><strong>{{ b.vehicleModel }}</strong></div>
            <div class="row"><span>Amount</span><strong>{{ b.totalAmount | currency }} {{ b.currency }}</strong></div>
            <div class="row"><span>Payment</span><app-status-badge [status]="b.paymentStatus" /></div>

            <div class="actions mt-2">
              <button mat-flat-button color="primary" *ngIf="b.bookingStatus === 'pending'" (click)="pay(b)">
                <mat-icon>payments</mat-icon> Pay & confirm
              </button>
              <button mat-stroked-button *ngIf="b.bookingStatus === 'confirmed'" (click)="checkIn(b)">
                <mat-icon>login</mat-icon> Check in
              </button>
              <button mat-stroked-button *ngIf="b.bookingStatus === 'checked-in'" (click)="checkOut(b)">
                <mat-icon>logout</mat-icon> Check out
              </button>
              <button mat-stroked-button color="warn" *ngIf="canCancel(b)" (click)="cancel(b)">
                <mat-icon>cancel</mat-icon> Cancel booking
              </button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .wrap { max-width: 900px; margin: 1.5rem auto 3rem; padding: 0 1rem; }
    .back { display: inline-flex; align-items: center; gap: .3rem; font-size: .85rem; margin-bottom: .75rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; padding: .35rem 0; font-size: .92rem; }
    .row span { color: var(--pe-muted); }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; }
    .center-spinner { margin: 2rem auto; }
    @media (max-width: 800px) { .grid[style] { grid-template-columns: 1fr !important; } }
  `],
})
export class BookingDetailsComponent {
  private readonly bookingService = inject(BookingService);
  private readonly notifier = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly booking = signal<Booking | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.bookingService.get(this.id()).subscribe({
      next: (b) => {
        this.booking.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  canCancel(b: Booking): boolean {
    const isOwner = (b.userId as any)?._id === this.auth.user()?._id || b.userId === this.auth.user()?._id;
    return isOwner && (b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed');
  }

  async pay(b: Booking): Promise<void> {
    try {
      const updated = await this.bookingService.confirm(b._id, 'upi');
      this.booking.set({ ...b, ...updated });
      this.notifier.success('Payment successful');
    } catch {
      // interceptor shows error
    }
  }

  async checkIn(b: Booking): Promise<void> {
    try {
      const updated = await this.bookingService.checkIn(b._id);
      this.booking.set({ ...b, ...updated });
      this.notifier.success('Checked in');
    } catch {
      // interceptor shows error
    }
  }

  async checkOut(b: Booking): Promise<void> {
    try {
      const updated = await this.bookingService.checkOut(b._id);
      this.booking.set({ ...b, ...updated });
      this.notifier.success('Checked out — booking completed');
    } catch {
      // interceptor shows error
    }
  }

  async cancel(b: Booking): Promise<void> {
    const ok = await this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel booking?',
        message: `${b.bookingReference} will be cancelled${b.paymentStatus === 'paid' ? ' and refunded' : ''}.`,
        confirmLabel: 'Cancel booking',
        danger: true,
      },
    }).afterClosed().toPromise();
    if (!ok) return;
    try {
      const updated = await this.bookingService.cancel(b._id);
      this.booking.set({ ...b, ...updated });
      this.notifier.success('Booking cancelled');
    } catch {
      // interceptor shows error
    }
  }
}
