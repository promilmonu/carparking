import { Component, Directive, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { debounceTime, Subject, switchMap, tap } from 'rxjs';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../services/notification.service';
import { Role, User } from '../../../core/models';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** Dialog to change a user's role. */
@Component({
  selector: 'app-role-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Change role — {{ data.user.name }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline">
        <mat-label>Role</mat-label>
        <mat-select [(ngModel)]="role">
          <mat-option value="customer">Customer</mat-option>
          <mat-option value="operator">Operator</mat-option>
          <mat-option value="admin">Admin</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="role">Save</button>
    </mat-dialog-actions>
  `,
})
export class RoleDialogComponent {
  role: Role;
  constructor(@Inject(MAT_DIALOG_DATA) public data: { user: User }) {
    this.role = data.user.role;
  }
}

/** Shared table logic for customers and operators (directive-based base class). */
@Directive()
export abstract class UsersTableBase {
  ngOnInit(): void {
    this.init();
  }
  protected readonly admin = inject(AdminService);
  protected readonly notifier = inject(NotificationService);
  protected readonly dialog = inject(MatDialog);

  readonly users = signal<User[]>([]);
  readonly meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false });
  readonly search = signal('');
  readonly loading = signal(false);

  page = 1;
  limit = 10;
  private readonly searchSubject = new Subject<string>();

  abstract readonly role: Role;
  abstract readonly title: string;
  abstract readonly subtitle: string;
  readonly cols = ['name', 'email', 'phone', 'status', 'joined', 'actions'];

  protected init(): void {
    this.searchSubject.pipe(debounceTime(350), switchMap(() => this.fetch())).subscribe();
    this.reload();
  }

  protected fetch() {
    this.loading.set(true);
    return this.admin.users({
      page: this.page,
      limit: this.limit,
      role: this.role,
      search: this.search() || undefined,
    }).pipe(
      tap({
        next: (res) => {
          this.users.set(res.items);
          this.meta.set(res.meta);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
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

  async toggleStatus(u: User): Promise<void> {
    const ok = await this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: u.isActive ? 'Deactivate user?' : 'Activate user?',
        message: u.isActive
          ? `${u.name} will no longer be able to log in.`
          : `${u.name} will be able to log in again.`,
        confirmLabel: u.isActive ? 'Deactivate' : 'Activate',
        danger: u.isActive,
      },
    }).afterClosed().toPromise();
    if (!ok) return;
    try {
      await this.admin.setUserStatus(u._id, !u.isActive);
      this.notifier.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      this.fetch().subscribe({ error: () => {} });
    } catch {
      // interceptor shows error
    }
  }

  async changeRole(u: User): Promise<void> {
    const role = await this.dialog.open(RoleDialogComponent, { data: { user: u } }).afterClosed().toPromise();
    if (!role || role === u.role) return;
    try {
      await this.admin.setUserRole(u._id, role);
      this.notifier.success(`Role updated to ${role}`);
      this.fetch().subscribe({ error: () => {} });
    } catch {
      // interceptor shows error
    }
  }
}

/** Customers management. */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule, StatusBadgeComponent,
  ],
  template: `
    <h1 class="page-title">{{ title }}</h1>
    <p class="page-subtitle">{{ subtitle }}</p>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Name, email or phone" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>

    <div class="card">
      <table mat-table [dataSource]="users()" class="full-width muted-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let u"><strong>{{ u.name }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>
        <ng-container matColumnDef="phone">
          <th mat-header-cell *matHeaderCellDef>Phone</th>
          <td mat-cell *matCellDef="let u">{{ u.phone || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let u"><app-status-badge [status]="u.isActive ? 'active' : 'inactive'" /></td>
        </ng-container>
        <ng-container matColumnDef="joined">
          <th mat-header-cell *matHeaderCellDef>Joined</th>
          <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'MMM d, y' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let u">
            <button mat-icon-button matTooltip="Change role" (click)="changeRole(u)"><mat-icon>admin_panel_settings</mat-icon></button>
            <button mat-icon-button [matTooltip]="u.isActive ? 'Deactivate' : 'Activate'" (click)="toggleStatus(u)">
              <mat-icon>{{ u.isActive ? 'person_off' : 'person' }}</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>
      <div *ngIf="!users().length" class="empty-state text-muted">No users found.</div>
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
    .filters { display: grid; grid-template-columns: 2fr; gap: 1rem; }
    .empty-state { text-align: center; padding: 2rem; }
  `],
})
export class CustomersComponent extends UsersTableBase {
  readonly role: Role = 'customer';
  readonly title = 'Customers';
  readonly subtitle = 'Registered customers and their account status';
  override readonly cols = ['name', 'email', 'phone', 'status', 'joined', 'actions'];
}

/** Operators management (same table, operator role). */
@Component({
  selector: 'app-operators',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule, StatusBadgeComponent,
  ],
  template: `
    <h1 class="page-title">{{ title }}</h1>
    <p class="page-subtitle">{{ subtitle }}</p>

    <div class="card mb-2 filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Name, email or phone" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>

    <div class="card">
      <table mat-table [dataSource]="users()" class="full-width muted-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let u"><strong>{{ u.name }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>
        <ng-container matColumnDef="phone">
          <th mat-header-cell *matHeaderCellDef>Phone</th>
          <td mat-cell *matCellDef="let u">{{ u.phone || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let u"><app-status-badge [status]="u.isActive ? 'active' : 'inactive'" /></td>
        </ng-container>
        <ng-container matColumnDef="joined">
          <th mat-header-cell *matHeaderCellDef>Joined</th>
          <td mat-cell *matCellDef="let u">{{ u.createdAt | date:'MMM d, y' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let u">
            <button mat-icon-button matTooltip="Change role" (click)="changeRole(u)"><mat-icon>admin_panel_settings</mat-icon></button>
            <button mat-icon-button [matTooltip]="u.isActive ? 'Deactivate' : 'Activate'" (click)="toggleStatus(u)">
              <mat-icon>{{ u.isActive ? 'person_off' : 'person' }}</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols;"></tr>
      </table>
      <div *ngIf="!users().length" class="empty-state text-muted">No operators found. Promote a customer to operator using the role action.</div>
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
    .filters { display: grid; grid-template-columns: 2fr; gap: 1rem; }
    .empty-state { text-align: center; padding: 2rem; }
  `],
})
export class OperatorsComponent extends UsersTableBase {
  readonly role: Role = 'operator';
  readonly title = 'Operators';
  readonly subtitle = 'Parking operators who can check vehicles in and out';
  override readonly cols = ['name', 'email', 'phone', 'status', 'joined', 'actions'];
}
