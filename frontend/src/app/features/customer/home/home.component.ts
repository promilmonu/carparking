import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ParkingService } from '../../../services/parking.service';
import { ParkingLocation, VEHICLE_TYPES, PARKING_TYPES } from '../../../core/models';
import { ParkingCardComponent } from '../../../shared/components/parking-card/parking-card.component';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, ParkingCardComponent, StatusLabelPipe],
  template: `
    <section class="hero">
      <div class="hero-inner">
        <h1>Find &amp; book parking, effortlessly</h1>
        <p>Search live availability across city parking locations and reserve your slot in seconds.</p>

        <form class="search-bar" [formGroup]="searchForm" (ngSubmit)="search()">
          <mat-form-field appearance="outline">
            <mat-label>City or location</mat-label>
            <input matInput formControlName="search" placeholder="e.g. Bengaluru, Central Plaza" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Vehicle type</mat-label>
            <mat-select formControlName="vehicleType">
              <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v | statusLabel }}</mat-option>
            </mat-select>
          </mat-form-field>
          <button mat-flat-button color="primary" type="submit" class="search-btn">
            <mat-icon>local_parking</mat-icon> Find parking
          </button>
        </form>
      </div>
    </section>

    <section class="wrap">
      <div class="flex justify-between items-center mb-2">
        <div>
          <h2>Popular parking locations</h2>
          <p class="text-muted">Live availability updated in real time</p>
        </div>
        <a mat-button routerLink="/parking">View all <mat-icon>arrow_forward</mat-icon></a>
      </div>

      <div class="grid grid-2">
        <app-parking-card *ngFor="let loc of featured()" [location]="loc"></app-parking-card>
      </div>

      <div *ngIf="!featured().length" class="card empty-state text-muted">
        No active parking locations yet. Please check back soon.
      </div>

      <div class="grid grid-3 mt-2 how">
        <div class="card">
          <mat-icon>search</mat-icon>
          <h3>1. Search</h3>
          <p class="text-muted">Filter by city, vehicle type and price to find the right lot.</p>
        </div>
        <div class="card">
          <mat-icon>event_available</mat-icon>
          <h3>2. Pick a slot</h3>
          <p class="text-muted">See exactly which slots are free for your date and time window.</p>
        </div>
        <div class="card">
          <mat-icon>drive_eta</mat-icon>
          <h3>3. Drive in</h3>
          <p class="text-muted">Show your booking reference at the gate and park.</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero { background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 55%, #7986cb 100%); color: #fff; padding: 4rem 1rem 5rem; }
    .hero-inner { max-width: 900px; margin: 0 auto; text-align: center; }
    .hero h1 { font-size: 2.4rem; margin-bottom: .5rem; }
    .hero p { opacity: .9; margin-bottom: 2rem; }
    .search-bar { display: grid; grid-template-columns: 2fr 1fr auto; gap: .75rem; background: #fff; padding: 1rem; border-radius: var(--pe-radius); box-shadow: var(--pe-shadow-lg); text-align: left; }
    .search-btn { height: 56px; }
    .wrap { max-width: 1200px; margin: -2.5rem auto 2rem; padding: 0 1rem; }
    .how { margin-top: 2rem; }
    .how mat-icon { color: var(--pe-primary); font-size: 32px; width: 32px; height: 32px; }
    .empty-state { text-align: center; padding: 3rem; }
    @media (max-width: 760px) {
      .search-bar { grid-template-columns: 1fr; }
      .hero h1 { font-size: 1.6rem; }
    }
  `],
})
export class HomeComponent {
  private readonly parking = inject(ParkingService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly featured = signal<ParkingLocation[]>([]);
  readonly vehicleTypes = VEHICLE_TYPES;

  readonly searchForm = this.fb.nonNullable.group({
    search: [''],
    vehicleType: [''],
  });

  ngOnInit(): void {
    this.parking.listLocations({ limit: 4, vehicleType: 'car', sortBy: 'createdAt', sortOrder: 'desc' }).subscribe({
      next: (res) => this.featured.set(res.items),
    });
  }

  search(): void {
    const { search, vehicleType } = this.searchForm.getRawValue();
    this.router.navigate(['/parking'], { queryParams: { q: search || undefined, vehicleType: vehicleType || undefined } });
  }
}
