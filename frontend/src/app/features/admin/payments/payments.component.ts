import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, Subject, switchMap, tap } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { Payment } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatPaginatorModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, StatusBadgeComponent,
  ],
  template: `
    <h1 class="page-title">Payments</h1>
    <p class="page-subtitle">{{ auth.isAdmin() ? 'All payment transactions across the platform' : 'Your payment history' }}</p>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search transaction id</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (ngModelChange)="reload()">
          <mat-option value="">All</mat-option>
          <mat-option value="paid">Paid</mat-option>
          <mat-option value="refunded">Refunded</mat-option>
          <mat-option value="pending">Pending</mat-option>
          <mat-option value="failed">Failed</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <div class="card">
      <table mat-table [dataSource]="payments()" class="full-width muted-table">
        <ng-container matColumnDef="transaction">
          <th mat-header-cell *matHeaderCellDef>Transaction</th>
          <td mat-cell *matCellDef="let p">
            <strong>{{ p.transactionId }}</strong><br/>
            <span class="text-muted">{{ p.method }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="customer" *ngIf="auth.isAdmin()">
          <th mat-header-cell *matHeaderCellDef>Customer</th>
          <td mat-cell *matCellDef="let p">{{ $any(p.userId)?.name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="booking">
          <th mat-header-cell *matHeaderCellDef>Booking</th>
          <td mat-cell *matCellDef="let p">
            <span *ngIf="p.bookingId">{{ $any(p.bookingId)?.bookingReference }} · {{ $any(p.bookingId)?.slotNumber }}</span>
            <span *ngIf="!$any(p.bookingId)?.bookingReference">—</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef>Amount</th>
          <td mat-cell *matCellDef="let p"><strong>{{ p.amount | currency }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="paidAt">
          <th mat-header-cell *matHeaderCellDef>Paid at</th>
          <td mat-cell *matCellDef="let p">{{ p.paidAt | date:'MMM d, y HH:mm' }}</td>
        </ng-container>
        <ng-container matColumnDef="payStatus">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let p"><app-status-badge [status]="p.status" /></td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="visibleCols()"></tr>
        <tr mat-row *matRowDef="let row; columns: visibleCols();"></tr>
      </table>
      <div *ngIf="!payments().length" class="empty-state text-muted">No payments found.</div>
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
    .filters { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
    .empty-state { text-align: center; padding: 2rem; }
  `],
})
export class PaymentsComponent {
  private readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);

  readonly payments = signal<Payment[]>([]);
  readonly meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false });
  readonly search = signal('');

  statusFilter = '';
  private page = 1;
  private limit = 10;
  private readonly searchSubject = new Subject<string>();

  readonly allCols = ['transaction', 'customer', 'booking', 'amount', 'paidAt', 'payStatus'];

  visibleCols(): string[] {
    return this.auth.isAdmin() ? this.allCols : ['transaction', 'booking', 'amount', 'paidAt', 'payStatus'];
  }

  constructor() {
    this.searchSubject.pipe(debounceTime(350), switchMap(() => this.fetch())).subscribe();
    this.reload();
  }

  private fetch() {
    return this.admin.payments({
      page: this.page,
      limit: this.limit,
      search: this.search() || undefined,
      status: this.statusFilter || undefined,
    }).pipe(
      tap({
        next: (res) => {
          this.payments.set(res.items);
          this.meta.set(res.meta);
        },
      })
    );
  }

  reload(): void {
    this.page = 1;
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
