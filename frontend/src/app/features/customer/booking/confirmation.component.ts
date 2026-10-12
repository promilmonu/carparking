import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BookingService } from '../../../services/booking.service';
import { NotificationService } from '../../../services/notification.service';
import { Booking } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

/** Booking confirmation with reference + simulated payment. */
@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, StatusBadgeComponent, StatusLabelPipe],
  template: `
    <mat-spinner *ngIf="loading()" class="center-spinner"></mat-spinner>

    <div *ngIf="booking() as b" class="wrap">
      <div class="card hero-card">
        <mat-icon class="success-icon">check_circle</mat-icon>
        <h1>{{ b.bookingStatus === 'pending' ? 'Booking requested!' : 'Booking confirmed!' }}</h1>
        <p class="ref">Booking reference: <strong>{{ b.bookingReference }}</strong></p>
        <p class="text-muted">Show this reference at the parking entrance.</p>
        <app-status-badge [status]="b.bookingStatus" />
        <app-status-badge [status]="b.paymentStatus" />
      </div>

      <div class="card details">
        <div class="row"><span>Location</span><strong>{{ locationName(b) }}</strong></div>
        <div class="row"><span>Slot</span><strong>{{ b.slotNumber }}</strong></div>
        <div class="row"><span>Vehicle</span><strong>{{ b.vehicleNumber }} <span class="text-muted">({{ b.vehicleType | statusLabel }}<span *ngIf="b.vehicleModel">, {{ b.vehicleModel }}</span>)</span></strong></div>
        <div class="row"><span>Start</span><strong>{{ b.startTime | date:'MMM d, y HH:mm' }}</strong></div>
        <div class="row"><span>End</span><strong>{{ b.endTime | date:'MMM d, y HH:mm' }}</strong></div>
        <div class="row total"><span>Total amount</span><strong>{{ b.totalAmount | currency }}</strong></div>
      </div>

      <div class="actions">
        <button *ngIf="b.bookingStatus === 'pending'" mat-flat-button color="primary" (click)="pay()" [disabled]="paying()">
          <mat-icon>payments</mat-icon> {{ paying() ? 'Processing…' : 'Pay now & confirm' }}
        </button>
        <a mat-stroked-button routerLink="/my-bookings"><mat-icon>event_note</mat-icon> My bookings</a>
        <a mat-button routerLink="/parking"><mat-icon>search</mat-icon> Book more parking</a>
      </div>
    </div>
  `,
  styles: [`
    .wrap { max-width: 640px; margin: 2rem auto; padding: 0 1rem; display: flex; flex-direction: column; gap: 1rem; }
    .hero-card { text-align: center; padding: 2rem; }
    .success-icon { font-size: 56px; width: 56px; height: 56px; color: var(--pe-success); }
    .hero-card h1 { font-size: 1.5rem; }
    .ref { font-size: 1.05rem; }
    .details { display: flex; flex-direction: column; gap: .6rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; font-size: .95rem; }
    .row span { color: var(--pe-muted); }
    .row.total { border-top: 1px dashed var(--pe-border); padding-top: .6rem; font-size: 1.05rem; }
    .actions { display: flex; gap: .75rem; flex-wrap: wrap; justify-content: center; }
  `],
})
export class BookingConfirmationComponent {
  private readonly bookingService = inject(BookingService);
  private readonly notifier = inject(NotificationService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly booking = signal<Booking | null>(null);
  readonly loading = signal(true);
  readonly paying = signal(false);

  ngOnInit(): void {
    this.bookingService.get(this.id()).subscribe({
      next: (b) => {
        this.booking.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  locationName(b: Booking): string {
    return (b.parkingLocationId as any)?.name ?? 'Parking location';
  }

  async pay(): Promise<void> {
    this.paying.set(true);
    try {
      const updated = await this.bookingService.confirm(this.booking()!._id, 'upi');
      this.booking.set({ ...this.booking()!, ...updated });
      this.notifier.success('Payment successful — booking confirmed');
    } catch {
      // interceptor shows error
    } finally {
      this.paying.set(false);
    }
  }
}
