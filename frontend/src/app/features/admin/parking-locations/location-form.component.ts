import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ParkingService } from '../../../services/parking.service';
import { NotificationService } from '../../../services/notification.service';
import { FACILITIES, PARKING_TYPES, VEHICLE_TYPES, VehicleType } from '../../../core/models';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatCheckboxModule, MatIconModule, MatProgressSpinnerModule, StatusLabelPipe,
  ],
  template: `
    <a routerLink="/admin/locations" class="back-link"><mat-icon>arrow_back</mat-icon> Back to locations</a>
    <h1 class="page-title">{{ isEdit() ? 'Edit Parking Location' : 'Add Parking Location' }}</h1>
    <p class="page-subtitle">Fields marked with * are required. Prices are always billed from these backend-configured rates.</p>

    <mat-spinner *ngIf="loading()" class="center-spinner"></mat-spinner>

    <form *ngIf="!loading()" [formGroup]="form" (ngSubmit)="submit()" class="card form-grid">
      <div class="card section">
        <h3>General</h3>
        <mat-form-field appearance="outline">
          <mat-label>Location name *</mat-label>
          <input matInput formControlName="name" />
          <mat-error *ngIf="form.controls.name.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.controls.name.hasError('minlength')">Min 3 characters</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Location code *</mat-label>
          <input matInput formControlName="code" placeholder="e.g. CEN-01" />
          <mat-hint>Unique alphanumeric code (A-Z, 0-9)</mat-hint>
          <mat-error *ngIf="form.controls.code.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.controls.code.hasError('pattern')">Letters and numbers only</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Description</mat-label>
          <textarea matInput rows="3" formControlName="description"></textarea>
        </mat-form-field>
      </div>

      <div class="card section">
        <h3>Address</h3>
        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Full address *</mat-label>
          <input matInput formControlName="address" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>City *</mat-label>
          <input matInput formControlName="city" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>State *</mat-label>
          <input matInput formControlName="state" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Postal code *</mat-label>
          <input matInput formControlName="postalCode" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <div class="coord-row">
          <mat-form-field appearance="outline">
            <mat-label>Latitude (optional)</mat-label>
            <input matInput type="number" step="any" formControlName="lat" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Longitude (optional)</mat-label>
            <input matInput type="number" step="any" formControlName="lng" />
          </mat-form-field>
        </div>
      </div>

      <div class="card section">
        <h3>Parking configuration</h3>
        <mat-form-field appearance="outline">
          <mat-label>Parking type *</mat-label>
          <mat-select formControlName="parkingType">
            <mat-option *ngFor="let t of parkingTypes" [value]="t">{{ t | statusLabel }}</mat-option>
          </mat-select>
          <mat-error>Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Supported vehicle types *</mat-label>
          <mat-select formControlName="supportedVehicleTypes" multiple>
            <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v | statusLabel }}</mat-option>
          </mat-select>
          <mat-error *ngIf="form.controls.supportedVehicleTypes.hasError('required')">Select at least one</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Total capacity *</mat-label>
          <input matInput type="number" min="1" formControlName="totalCapacity" />
          <mat-error *ngIf="form.controls.totalCapacity.hasError('required')">Required</mat-error>
          <mat-error *ngIf="form.controls.totalCapacity.hasError('min')">Minimum 1</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Hourly price *</mat-label>
          <input matInput type="number" min="0" step="0.5" formControlName="hourlyRate" />
          <mat-error>Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Daily price *</mat-label>
          <input matInput type="number" min="0" step="1" formControlName="dailyRate" />
          <mat-error>Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Opening time *</mat-label>
          <input matInput type="time" formControlName="openingTime" />
          <mat-error *ngIf="form.controls.openingTime.hasError('required')">Required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Closing time *</mat-label>
          <input matInput type="time" formControlName="closingTime" />
          <mat-error *ngIf="form.controls.closingTime.hasError('required')">Required</mat-error>
        </mat-form-field>
      </div>

      <div class="card section">
        <h3>Facilities</h3>
        <div class="chips">
          <mat-checkbox *ngFor="let f of facilities" formControlName="{{ f }}">{{ f }}</mat-checkbox>
        </div>
      </div>

      <div class="card section">
        <h3>Images</h3>
        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Image URLs (one per line, max 10)</mat-label>
          <textarea matInput rows="3" formControlName="imagesText" placeholder="https://…"></textarea>
        </mat-form-field>
      </div>

      <div class="span-2 flex gap-2 justify-end">
        <a mat-button type="button" routerLink="/admin/locations">Cancel</a>
        <button mat-flat-button color="primary" [disabled]="saving()">
          {{ saving() ? 'Saving…' : (isEdit() ? 'Save changes' : 'Create location') }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: .3rem; font-size: .85rem; margin-bottom: .75rem; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .section { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; align-content: start; }
    .section h3 { grid-column: 1 / -1; font-size: 1rem; color: var(--pe-primary); }
    .span-2 { grid-column: 1 / -1; }
    .coord-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 1rem; }
    .center-spinner { margin: 3rem auto; }
    @media (max-width: 900px) { .form-grid, .section { grid-template-columns: 1fr; } }
  `],
})
export class LocationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly parking = inject(ParkingService);
  private readonly notifier = inject(NotificationService);
  private readonly router = inject(Router);

  readonly id = input<string | null>(null);
  readonly isEdit = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly parkingTypes = PARKING_TYPES;
  readonly vehicleTypes = VEHICLE_TYPES;
  readonly facilities = FACILITIES;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]+$/)]],
    description: [''],
    address: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', Validators.required],
    lat: [null as number | null],
    lng: [null as number | null],
    parkingType: ['', Validators.required],
    supportedVehicleTypes: [[] as VehicleType[], Validators.required],
    totalCapacity: [1, [Validators.required, Validators.min(1)]],
    hourlyRate: [0, Validators.required],
    dailyRate: [0, Validators.required],
    openingTime: ['', Validators.required],
    closingTime: ['', Validators.required],
    imagesText: [''],
    ...Object.fromEntries(FACILITIES.map((f) => [f, [false]])),
  });

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.isEdit.set(true);
      this.loading.set(true);
      this.parking.getLocation(id).subscribe({
        next: (loc) => {
          this.form.patchValue({
            name: loc.name,
            code: loc.code,
            description: loc.description ?? '',
            address: loc.address,
            city: loc.city,
            state: loc.state,
            postalCode: loc.postalCode,
            lat: loc.coordinates?.lat ?? null,
            lng: loc.coordinates?.lng ?? null,
            parkingType: loc.parkingType,
            supportedVehicleTypes: [...loc.supportedVehicleTypes],
            totalCapacity: loc.totalCapacity,
            hourlyRate: loc.hourlyRate,
            dailyRate: loc.dailyRate,
            openingTime: loc.openingTime,
            closingTime: loc.closingTime,
            imagesText: (loc.images ?? []).join('\n'),
            ...Object.fromEntries(FACILITIES.map((f) => [f, loc.facilities.includes(f)])),
          });
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifier.error('Please fix the highlighted fields');
      return;
    }

    const v = this.form.getRawValue();
    const payload: any = {
      name: v.name,
      code: v.code.toUpperCase(),
      description: v.description,
      address: v.address,
      city: v.city,
      state: v.state,
      postalCode: v.postalCode,
      coordinates: { lat: v.lat, lng: v.lng },
      parkingType: v.parkingType,
      supportedVehicleTypes: v.supportedVehicleTypes,
      totalCapacity: v.totalCapacity,
      hourlyRate: v.hourlyRate,
      dailyRate: v.dailyRate,
      openingTime: v.openingTime,
      closingTime: v.closingTime,
      facilities: FACILITIES.filter((f) => (v as Record<string, unknown>)[f]),
      images: v.imagesText.split('\n').map((s: string) => s.trim()).filter(Boolean).slice(0, 10),
    };

    this.saving.set(true);
    try {
      if (this.isEdit()) {
        await this.parking.updateLocation(this.id()!, payload);
        this.notifier.success('Parking location updated');
      } else {
        await this.parking.createLocation(payload);
        this.notifier.success('Parking location created — add slots to make it bookable');
      }
      await this.router.navigate(['/admin/locations']);
    } catch {
      // interceptor shows details
    } finally {
      this.saving.set(false);
    }
  }
}
