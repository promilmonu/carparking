import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ParkingService } from '../../../services/parking.service';
import { BookingService } from '../../../services/booking.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { ParkingLocation, ParkingSlot, VEHICLE_TYPES, VehicleType } from '../../../core/models';
import { SlotGridComponent } from '../../../shared/components/slot-grid/slot-grid.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

/** Customer page: location info + availability search + slot pick + booking. */
@Component({
  selector: 'app-location-details',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressSpinnerModule,
    SlotGridComponent, StatusLabelPipe,
  ],
  template: `
    <mat-spinner *ngIf="loadingLocation()" class="center-spinner"></mat-spinner>

    <ng-container *ngIf="location() as loc">
      <section class="cover" [style.backgroundImage]="loc.images?.length ? 'url(' + loc.images[0] + ')' : ''">
        <div class="cover-overlay">
          <a routerLink="/parking" class="back"><mat-icon>arrow_back</mat-icon> Back to search</a>
          <h1>{{ loc.name }}</h1>
          <p><mat-icon>location_on</mat-icon> {{ loc.address }}, {{ loc.city }}, {{ loc.state }} {{ loc.postalCode }}</p>
          <div class="chips">
            <span class="chip">{{ loc.parkingType | statusLabel }}</span>
            <span class="chip">{{ loc.openingTime }} – {{ loc.closingTime }}</span>
            <span class="chip" *ngFor="let f of loc.facilities">{{ f }}</span>
          </div>
        </div>
      </section>

      <div class="wrap grid gap-2" style="grid-template-columns: 1.4fr 1fr; align-items: start;">
        <div>
          <div class="card mb-2">
            <h3>About this parking</h3>
            <p>{{ loc.description || 'No description provided.' }}</p>
            <div class="info-grid">
              <div><span class="text-muted">Hourly rate</span><strong>{{ loc.hourlyRate | currency }}</strong></div>
              <div><span class="text-muted">Daily rate</span><strong>{{ loc.dailyRate | currency }}</strong></div>
              <div><span class="text-muted">Total capacity</span><strong>{{ loc.totalCapacity }}</strong></div>
              <div><span class="text-muted">Free now</span><strong>{{ loc.availableSlots ?? 0 }}</strong></div>
            </div>
            <p class="text-muted supported">
              Supports: <strong>{{ loc.supportedVehicleTypes.join(', ') }}</strong>
            </p>
          </div>

          <div class="card">
            <h3>Choose your slot</h3>

            <form class="search-params" [formGroup]="windowForm" (ngSubmit)="checkAvailability()">
              <mat-form-field appearance="outline">
                <mat-label>Vehicle type</mat-label>
                <mat-select formControlName="vehicleType">
                  <mat-option *ngFor="let v of supportedTypes(loc)" [value]="v">{{ v | statusLabel }}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Date</mat-label>
                <input matInput type="date" formControlName="date" [min]="today()" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Start time</mat-label>
                <input matInput type="time" formControlName="startTime" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>End time</mat-label>
                <input matInput type="time" formControlName="endTime" />
              </mat-form-field>
              <button mat-flat-button color="primary" [disabled]="checking()">
                {{ checking() ? 'Checking…' : 'Check availability' }}
              </button>
            </form>

            <mat-spinner *ngIf="checking()" diameter="28" class="center-spinner"></mat-spinner>

            <ng-container *ngIf="slots()">
              <p class="text-muted">
                {{ availableCount() }} of {{ slots()!.length }} slots are free for the selected period. Click a green slot to select it.
              </p>
              <app-slot-grid [slots]="slots()!" [selectable]="true" [selectedSlotId]="selectedSlot()?._id ?? null" (select)="onSlotSelected($event)"></app-slot-grid>
            </ng-container>
          </div>
        </div>

        <aside class="card booking-form">
          <h3>Your booking</h3>

          <div class="summary" *ngIf="selectedSlot() as slot">
            <div class="row"><span>Location</span><strong>{{ loc.name }}</strong></div>
            <div class="row"><span>Slot</span><strong>{{ slot.slotNumber }} ({{ slot.floor }})</strong></div>
            <div class="row"><span>Period</span><strong>{{ windowLabel() }}</strong></div>
            <div class="row"><span>Rate</span><strong>{{ loc.hourlyRate | currency }}/hr · {{ loc.dailyRate | currency }}/day</strong></div>
          </div>
          <p *ngIf="!selectedSlot()" class="text-muted hint">
            Select a date, time window and an available slot to continue.
          </p>

          <form [formGroup]="bookingForm" (ngSubmit)="confirmBooking()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Vehicle registration number</mat-label>
              <input matInput formControlName="vehicleNumber" placeholder="KA-01-AB-1234" />
              <mat-error *ngIf="bookingForm.controls.vehicleNumber.hasError('required')">Required</mat-error>
              <mat-error *ngIf="bookingForm.controls.vehicleNumber.hasError('minlength')">Enter a valid registration number</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Vehicle model (optional)</mat-label>
              <input matInput formControlName="vehicleModel" placeholder="e.g. Hyundai Creta" />
            </mat-form-field>

            <div class="estimate" *ngIf="selectedSlot()">
              <span>Estimated duration: <strong>{{ estimatedHours }} hr</strong></span>
              <span class="text-muted">Final price is calculated by the server.</span>
            </div>

            <button mat-flat-button color="primary" class="full-width" type="submit"
                    [disabled]="!selectedSlot() || booking()">
              {{ booking() ? 'Booking…' : (auth.isLoggedIn() ? 'Confirm booking' : 'Log in to book') }}
            </button>
            <p class="text-muted tiny">
              By booking you agree to the parking rules of this location. Cancel free of charge before check-in.
            </p>
          </form>
        </aside>
      </div>
    </ng-container>
  `,
  styles: [`
    .cover { height: 240px; background: linear-gradient(135deg, #3f51b5, #7986cb) center/cover; position: relative; }
    .cover-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18,25,70,.25), rgba(18,25,70,.75)); color: #fff; padding: 1.25rem 2rem; display: flex; flex-direction: column; justify-content: flex-end; }
    .cover-overlay h1 { margin: .25rem 0; }
    .cover-overlay p { display: flex; align-items: center; gap: .3rem; margin: 0 0 .5rem; }
    .back { color: #fff; display: inline-flex; align-items: center; gap: .3rem; font-size: .85rem; }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .chip { background: rgba(255,255,255,.18); padding: .15rem .6rem; border-radius: 999px; font-size: .72rem; text-transform: capitalize; }
    .wrap { max-width: 1200px; margin: 1.5rem auto 3rem; padding: 0 1rem; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0 .5rem; }
    .info-grid span { display: block; font-size: .78rem; }
    .supported { font-size: .85rem; text-transform: capitalize; }
    .search-params { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: .75rem; align-items: center; }
    .booking-form { position: sticky; top: 1rem; }
    .summary { background: #f4f6fb; border-radius: 8px; padding: .9rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: .5rem; }
    .summary .row { display: flex; justify-content: space-between; font-size: .88rem; gap: 1rem; }
    .estimate { display: flex; flex-direction: column; gap: .2rem; font-size: .85rem; margin-bottom: .75rem; }
    .hint { background: #f4f6fb; padding: .9rem; border-radius: 8px; font-size: .88rem; }
    .tiny { font-size: .72rem; margin-top: .75rem; }
    .center-spinner { margin: 1rem auto; }
    @media (max-width: 1000px) {
      .wrap.grid { grid-template-columns: 1fr !important; }
      .booking-form { position: static; }
      .search-params { grid-template-columns: 1fr 1fr; }
      .info-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class LocationDetailsComponent {
  private readonly parking = inject(ParkingService);
  private readonly bookingService = inject(BookingService);
  private readonly notifier = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly auth = inject(AuthService);
  readonly id = input.required<string>();

  readonly location = signal<ParkingLocation | null>(null);
  readonly loadingLocation = signal(true);
  readonly slots = signal<ParkingSlot[] | null>(null);
  readonly checking = signal(false);
  readonly booking = signal(false);
  readonly selectedSlot = signal<ParkingSlot | null>(null);

  readonly windowForm = this.fb.nonNullable.group({
    vehicleType: ['car' as VehicleType, Validators.required],
    date: [this.defaultDate(), Validators.required],
    startTime: ['09:00', Validators.required],
    endTime: ['13:00', Validators.required],
  });

  readonly bookingForm = this.fb.nonNullable.group({
    vehicleNumber: ['', [Validators.required, Validators.minLength(3)]],
    vehicleModel: [''],
  });

  ngOnInit(): void {
    this.parking.getLocation(this.id()).subscribe({
      next: (loc) => {
        this.location.set(loc);
        const supported = loc.supportedVehicleTypes;
        if (!supported.includes(this.windowForm.getRawValue().vehicleType) && supported.length) {
          this.windowForm.patchValue({ vehicleType: supported[0] });
        }
        this.loadingLocation.set(false);
        this.checkAvailability();
      },
      error: () => this.loadingLocation.set(false),
    });
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  defaultDate(): string {
    return this.today();
  }

  supportedTypes(loc: ParkingLocation): VehicleType[] {
    return loc.supportedVehicleTypes;
  }

  private window(): { start: Date; end: Date } | null {
    const { date, startTime, endTime } = this.windowForm.getRawValue();
    if (!date || !startTime || !endTime) return null;
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return { start, end };
  }

  get estimatedHours(): number {
    const w = this.window();
    if (!w) return 0;
    return Math.max(1, Math.ceil((w.end.getTime() - w.start.getTime()) / 3600000));
  }

  windowLabel(): string {
    const w = this.window();
    if (!w) return '—';
    return `${w.start.toLocaleDateString()} ${this.windowForm.getRawValue().startTime} → ${this.windowForm.getRawValue().endTime}`;
  }

  checkAvailability(): void {
    const w = this.window();
    if (!w) {
      this.notifier.error('End time must be after start time');
      return;
    }
    this.selectedSlot.set(null);
    this.checking.set(true);
    this.parking.availableSlots(this.id(), {
      vehicleType: this.windowForm.getRawValue().vehicleType,
      startTime: w.start.toISOString(),
      endTime: w.end.toISOString(),
    }).subscribe({
      next: (res) => {
        this.slots.set(res.slots);
        this.checking.set(false);
      },
      error: () => this.checking.set(false),
    });
  }

  availableCount(): number {
    return (this.slots() ?? []).filter((s) => s.isAvailable).length;
  }

  onSlotSelected(slot: ParkingSlot): void {
    this.selectedSlot.set(slot);
  }

  async confirmBooking(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      await this.router.navigate(['/login'], { queryParams: { redirect: `/parking/${this.id()}` } });
      return;
    }
    if (!this.selectedSlot()) {
      this.notifier.error('Select an available slot first');
      return;
    }
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }
    const w = this.window();
    if (!w) {
      this.notifier.error('Choose a valid date and time window');
      return;
    }

    const { vehicleNumber, vehicleModel } = this.bookingForm.getRawValue();
    this.booking.set(true);
    try {
      const res = await this.bookingService.create({
        parkingLocationId: this.id(),
        parkingSlotId: this.selectedSlot()!._id,
        vehicleNumber,
        vehicleType: this.windowForm.getRawValue().vehicleType,
        vehicleModel,
        startTime: w.start.toISOString(),
        endTime: w.end.toISOString(),
      });
      this.notifier.success(`Booking ${res.booking.bookingReference} created`);
      await this.router.navigate(['/booking-confirmation', res.booking._id]);
    } catch {
      // 409 conflict handled by interceptor; refresh availability
      this.checkAvailability();
    } finally {
      this.booking.set(false);
    }
  }
}
