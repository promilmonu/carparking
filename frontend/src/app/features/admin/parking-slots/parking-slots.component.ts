import { Component, Inject, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ParkingService } from '../../../services/parking.service';
import { NotificationService } from '../../../services/notification.service';
import { ParkingLocation, ParkingSlot, SLOT_STATUSES, SLOT_CATEGORIES, VEHICLE_TYPES } from '../../../core/models';
import { SlotGridComponent } from '../../../shared/components/slot-grid/slot-grid.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

/** Dialog: add a single slot or a bulk range. */
@Component({
  selector: 'app-add-slot-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, MatButtonToggleModule, StatusLabelPipe],
  template: `
    <h2 mat-dialog-title>Add slots</h2>
    <mat-dialog-content>
      <mat-button-toggle-group [(ngModel)]="mode" class="mb">
        <mat-button-toggle value="bulk">Bulk range</mat-button-toggle>
        <mat-button-toggle value="single">Single slot</mat-button-toggle>
      </mat-button-toggle-group>

      <form *ngIf="mode === 'bulk'" [formGroup]="bulkForm" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Slot number prefix</mat-label>
          <input matInput formControlName="prefix" placeholder="e.g. A-" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Start number</mat-label>
          <input matInput type="number" formControlName="startNumber" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>How many slots</mat-label>
          <input matInput type="number" min="1" max="500" formControlName="count" />
          <mat-error *ngIf="bulkForm.controls.count.hasError('required')">Required</mat-error>
          <mat-error *ngIf="bulkForm.controls.count.hasError('min')">At least 1</mat-error>
        </mat-form-field>
      </form>

      <form *ngIf="mode === 'single'" [formGroup]="singleForm" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Slot number</mat-label>
          <input matInput formControlName="slotNumber" placeholder="e.g. A-01" />
          <mat-error *ngIf="singleForm.controls.slotNumber.hasError('required')">Required</mat-error>
        </mat-form-field>
      </form>

      <form *ngIf="mode" [formGroup]="commonForm" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Vehicle type</mat-label>
          <mat-select formControlName="vehicleType">
            <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v | statusLabel }}</mat-option>
          </mat-select>
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Floor / level</mat-label>
          <input matInput formControlName="floor" placeholder="G, 1, B1…" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            <mat-option *ngFor="let c of categories" [value]="c">{{ c | statusLabel }}</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="!mode">Add</button>
    </mat-dialog-actions>
  `,
  styles: [`.stack { display: flex; flex-direction: column; } .mb { margin-bottom: 1rem; } mat-dialog-content { min-width: 330px; }`],
})
export class AddSlotDialogComponent {
  readonly vehicleTypes = VEHICLE_TYPES;
  readonly categories = SLOT_CATEGORIES;
  mode: 'bulk' | 'single' | '' = 'bulk';

  private readonly fb = inject(FormBuilder);
  readonly bulkForm = this.fb.nonNullable.group({
    prefix: [''],
    startNumber: [1],
    count: [10, [Validators.required, Validators.min(1), Validators.max(500)]],
  });
  readonly singleForm = this.fb.nonNullable.group({ slotNumber: ['', Validators.required] });
  readonly commonForm = this.fb.nonNullable.group({
    vehicleType: ['car', Validators.required],
    floor: ['G'],
    category: ['regular'],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: { locationId: string }, private readonly ref: MatDialogRef<AddSlotDialogComponent>) {}

  save(): void {
    if (!this.mode) return;
    const common = this.commonForm.getRawValue();
    let payload: unknown;
    if (this.mode === 'bulk') {
      if (this.bulkForm.invalid) return;
      payload = { ...this.bulkForm.getRawValue(), ...common };
    } else {
      if (this.singleForm.invalid) return;
      payload = { ...this.singleForm.getRawValue(), ...common };
    }
    this.ref.close(payload);
  }
}

/** Dialog: edit one slot. */
@Component({
  selector: 'app-edit-slot-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, StatusLabelPipe],
  template: `
    <h2 mat-dialog-title>Edit slot {{ data.slot.slotNumber }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="stack">
        <mat-form-field appearance="outline">
          <mat-label>Slot number</mat-label>
          <input matInput formControlName="slotNumber" />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Vehicle type</mat-label>
          <mat-select formControlName="vehicleType">
            <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v | statusLabel }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Floor</mat-label>
          <input matInput formControlName="floor" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            <mat-option *ngFor="let c of categories" [value]="c">{{ c | statusLabel }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option *ngFor="let s of statuses" [value]="s">{{ s | statusLabel }}</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.stack { display: flex; flex-direction: column; } mat-dialog-content { min-width: 330px; }`],
})
export class EditSlotDialogComponent {
  readonly vehicleTypes = VEHICLE_TYPES;
  readonly categories = SLOT_CATEGORIES;
  readonly statuses = SLOT_STATUSES;

  private readonly fb = inject(FormBuilder);
  readonly data = inject<{ slot: ParkingSlot }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<EditSlotDialogComponent>);

  readonly form = this.fb.nonNullable.group({
    slotNumber: [this.data.slot.slotNumber, Validators.required],
    vehicleType: [this.data.slot.vehicleType, Validators.required],
    floor: [this.data.slot.floor],
    category: [this.data.slot.category],
    status: [this.data.slot.status],
  });

  save(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.getRawValue());
  }
}

/** Admin screen: manage the slots of one parking location. */
@Component({
  selector: 'app-parking-slots',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatFormFieldModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatButtonToggleModule, MatDialogModule, SlotGridComponent, StatusBadgeComponent, StatusLabelPipe,
  ],
  template: `
    <div class="flex justify-between items-center mb-2 flex-wrap gap-2">
      <div>
        <h1 class="page-title">Parking Slots</h1>
        <p class="page-subtitle" style="margin:0">Configure slots and monitor occupancy per location</p>
      </div>
      <div class="flex gap-1">
        <a mat-stroked-button routerLink="/admin/locations"><mat-icon>location_on</mat-icon> Locations</a>
        <button mat-flat-button color="primary" (click)="openAdd()" [disabled]="!location()">
          <mat-icon>add</mat-icon> Add Slots
        </button>
      </div>
    </div>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Parking location</mat-label>
        <mat-select [(ngModel)]="selectedLocationId" (ngModelChange)="onLocationChange($event)">
          <mat-option *ngFor="let l of locations()" [value]="l._id">{{ l.name }} ({{ l.code }})</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (ngModelChange)="loadSlots()">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let s of statuses" [value]="s">{{ s | statusLabel }}</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Vehicle type</mat-label>
        <mat-select [(ngModel)]="vehicleFilter" (ngModelChange)="loadSlots()">
          <mat-option value="">All</mat-option>
          <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v | statusLabel }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <ng-container *ngIf="location() as loc">
      <div class="card mb-2 summary flex flex-wrap gap-2">
        <span><strong>{{ loc.name }}</strong> — {{ loc.address }}, {{ loc.city }}</span>
        <span class="text-muted">Capacity: {{ loc.totalCapacity }}</span>
        <span class="text-muted">Slots: {{ slots().length }}</span>
      </div>

      <div class="card">
        <app-slot-grid [slots]="slots()" (select)="onSlotClick($event)"></app-slot-grid>
        <div class="slot-actions" *ngIf="activeSlot() as slot">
          <strong>{{ slot.slotNumber }}</strong>
          <app-status-badge [status]="slot.status" />
          <span class="text-muted">{{ slot.vehicleType | statusLabel }} · floor {{ slot.floor }} · {{ slot.category | statusLabel }}</span>
          <span class="spacer"></span>
          <button mat-stroked-button (click)="openEdit(slot)"><mat-icon>edit</mat-icon> Edit</button>
          <button mat-stroked-button (click)="sendToMaintenance(slot)" *ngIf="slot.status !== 'maintenance'">
            <mat-icon>build</mat-icon> Maintenance
          </button>
          <button mat-stroked-button (click)="restoreSlot(slot)" *ngIf="slot.status === 'maintenance'">
            <mat-icon>restore</mat-icon> Restore
          </button>
        </div>
      </div>
    </ng-container>

    <div *ngIf="!location()" class="card empty-state text-muted">
      Select a parking location to manage its slots.
    </div>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; }
    .summary { font-size: .9rem; }
    .slot-actions { display: flex; align-items: center; gap: .75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--pe-border); flex-wrap: wrap; }
    .spacer { flex: 1; }
    .empty-state { text-align: center; padding: 3rem; }
    @media (max-width: 900px) { .filters { grid-template-columns: 1fr; } }
  `],
})
export class ParkingSlotsComponent {
  private readonly parking = inject(ParkingService);
  private readonly notifier = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly locationId = input<string | null>(null);

  readonly locations = signal<ParkingLocation[]>([]);
  readonly location = signal<ParkingLocation | null>(null);
  readonly slots = signal<ParkingSlot[]>([]);
  readonly activeSlot = signal<ParkingSlot | null>(null);

  readonly statuses = SLOT_STATUSES;
  readonly vehicleTypes = VEHICLE_TYPES;

  selectedLocationId = '';
  statusFilter = '';
  vehicleFilter = '';

  ngOnInit(): void {
    this.parking.listLocations({ limit: 100, sortBy: 'name', sortOrder: 'asc' }).subscribe({
      next: (res) => {
        this.locations.set(res.items);
        const preset = this.locationId() ?? res.items[0]?._id ?? '';
        if (preset) this.onLocationChange(preset);
      },
    });
  }

  onLocationChange(id: string): void {
    this.selectedLocationId = id;
    this.activeSlot.set(null);
    const loc = this.locations().find((l) => l._id === id);
    this.location.set(loc ?? null);
    this.loadSlots();
  }

  loadSlots(): void {
    if (!this.selectedLocationId) return;
    this.parking.listSlots(this.selectedLocationId, {
      status: this.statusFilter || undefined,
      vehicleType: this.vehicleFilter || undefined,
      view: 'grid',
    }).subscribe({
      next: (res) => this.slots.set(res.data ?? []),
    });
  }

  onSlotClick(slot: ParkingSlot): void {
    this.activeSlot.set(slot);
  }

  async openAdd(): Promise<void> {
    const payload = await this.dialog.open(AddSlotDialogComponent, { data: { locationId: this.selectedLocationId } })
      .afterClosed().toPromise();
    if (!payload) return;
    try {
      await this.parking.createSlots(this.selectedLocationId, payload);
      this.notifier.success('Slots added');
      this.loadSlots();
      // capacity may have been auto-synced
      this.parking.getLocation(this.selectedLocationId).subscribe({ next: (l) => this.location.set(l) });
    } catch {
      // interceptor shows error (e.g. duplicate slot numbers)
    }
  }

  async openEdit(slot: ParkingSlot): Promise<void> {
    const payload = await this.dialog.open(EditSlotDialogComponent, { data: { slot } }).afterClosed().toPromise();
    if (!payload) return;
    try {
      await this.parking.updateSlot(slot._id, payload);
      this.notifier.success('Slot updated');
      this.activeSlot.set(null);
      this.loadSlots();
    } catch {
      // interceptor shows error
    }
  }

  async sendToMaintenance(slot: ParkingSlot): Promise<void> {
    try {
      await this.parking.setSlotStatus(slot._id, 'maintenance');
      this.notifier.success(`Slot ${slot.slotNumber} sent to maintenance`);
      this.activeSlot.set(null);
      this.loadSlots();
    } catch {
      // backend refuses when active bookings exist
    }
  }

  async restoreSlot(slot: ParkingSlot): Promise<void> {
    try {
      await this.parking.setSlotStatus(slot._id, 'available');
      this.notifier.success(`Slot ${slot.slotNumber} restored`);
      this.activeSlot.set(null);
      this.loadSlots();
    } catch {
      // interceptor shows error
    }
  }
}
