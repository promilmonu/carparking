import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { debounceTime, Subject, switchMap, tap } from 'rxjs';
import { ParkingService } from '../../../services/parking.service';
import { ParkingLocation, PARKING_TYPES, VEHICLE_TYPES } from '../../../core/models';
import { ParkingCardComponent } from '../../../shared/components/parking-card/parking-card.component';

/** Customer parking search & listing. */
@Component({
  selector: 'app-customer-location-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatPaginatorModule, ParkingCardComponent],
  template: `
    <div class="wrap">
      <h1 class="page-title">Find parking</h1>
      <p class="page-subtitle">Only active, bookable locations are shown.</p>

      <div class="card mb-2 filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Search</mat-label>
          <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Name, city, address or code" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Vehicle type</mat-label>
          <mat-select [(ngModel)]="vehicleType" (ngModelChange)="reload()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let v of vehicleTypes" [value]="v">{{ v }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Parking type</mat-label>
          <mat-select [(ngModel)]="parkingType" (ngModelChange)="reload()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let t of parkingTypes" [value]="t">{{ t }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Max hourly price</mat-label>
          <input matInput type="number" min="0" [(ngModel)]="maxPrice" (ngModelChange)="reload()" />
        </mat-form-field>
      </div>

      <div class="grid grid-2">
        <app-parking-card *ngFor="let loc of locations()" [location]="loc"></app-parking-card>
      </div>

      <div *ngIf="!loading() && !locations().length" class="card empty-state text-muted">
        No parking locations match your search.
      </div>

      <mat-paginator
        class="card mt-2"
        [length]="meta().total"
        [pageIndex]="meta().page - 1"
        [pageSize]="meta().limit"
        [pageSizeOptions]="[6, 12, 24]"
        (page)="onPage($event)">
      </mat-paginator>
    </div>
  `,
  styles: [`
    .wrap { max-width: 1200px; margin: 1.5rem auto 3rem; padding: 0 1rem; }
    .filters { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; }
    .empty-state { text-align: center; padding: 3rem; }
    @media (max-width: 900px) { .filters { grid-template-columns: 1fr 1fr; } }
  `],
})
export class CustomerLocationListComponent {
  private readonly parking = inject(ParkingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly locations = signal<ParkingLocation[]>([]);
  readonly loading = signal(true);
  readonly meta = signal({ total: 0, page: 1, limit: 6, totalPages: 1, hasNext: false, hasPrev: false });
  readonly search = signal('');

  readonly vehicleTypes = VEHICLE_TYPES;
  readonly parkingTypes = PARKING_TYPES;

  vehicleType = '';
  parkingType = '';
  maxPrice: number | null = null;

  private page = 1;
  private limit = 6;
  private readonly searchSubject = new Subject<string>();

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.search.set(params.get('q') ?? '');
      this.vehicleType = params.get('vehicleType') ?? '';
      this.reload();
    });
    this.searchSubject.pipe(debounceTime(350), switchMap(() => this.fetch())).subscribe();
  }

  private fetch() {
    this.loading.set(true);
    return this.parking.listLocations({
      page: this.page,
      limit: this.limit,
      search: this.search() || undefined,
      vehicleType: this.vehicleType || undefined,
      parkingType: this.parkingType || undefined,
      maxPrice: this.maxPrice ?? undefined,
      sortBy: 'name',
      sortOrder: 'asc',
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
    this.router.navigate([], {
      queryParams: { q: this.search() || null, vehicleType: this.vehicleType || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.fetch().subscribe({ error: () => {} });
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.searchSubject.next(v);
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex + 1;
    this.limit = e.pageSize;
    this.fetch().subscribe({ error: () => {} });
  }
}
