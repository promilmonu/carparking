import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="wrap">
      <h1 class="page-title">My Profile</h1>
      <p class="page-subtitle">Manage your account details</p>

      <div class="grid" style="grid-template-columns: 1fr 1fr; align-items: start;">
        <form class="card" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
          <h3>Profile</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
            <mat-error>Name is required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput [value]="auth.user()?.email" disabled />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Phone</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
          <button mat-flat-button color="primary" [disabled]="savingProfile()">Save changes</button>
        </form>

        <form class="card" [formGroup]="passwordForm" (ngSubmit)="savePassword()">
          <h3>Change password</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Current password</mat-label>
            <input matInput type="password" formControlName="currentPassword" />
            <mat-error>Required</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>New password</mat-label>
            <input matInput type="password" formControlName="newPassword" />
            <mat-error *ngIf="passwordForm.controls.newPassword.hasError('required')">Required</mat-error>
            <mat-error *ngIf="passwordForm.controls.newPassword.hasError('minlength')">At least 6 characters</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Confirm new password</mat-label>
            <input matInput type="password" formControlName="confirmPassword" />
            <mat-error *ngIf="passwordForm.controls.confirmPassword.hasError('mismatch')">Passwords do not match</mat-error>
          </mat-form-field>
          <button mat-stroked-button color="primary" [disabled]="savingPassword()">Update password</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .wrap { max-width: 900px; margin: 1.5rem auto 3rem; padding: 0 1rem; }
    h3 { color: var(--pe-primary); }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr !important; } }
  `],
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly notifier = inject(NotificationService);

  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);

  readonly profileForm = this.fb.nonNullable.group({
    name: [this.auth.user()?.name ?? '', Validators.required],
    phone: [this.auth.user()?.phone ?? ''],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: ProfileComponent.passwordsMatch }
  );

  private static passwordsMatch(group: AbstractControl): { mismatch: boolean } | null {
    const p = group.get('newPassword')?.value;
    const c = group.get('confirmPassword')?.value;
    return p && c && p !== c ? { mismatch: true } : null;
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    try {
      await this.auth.updateProfile(this.profileForm.getRawValue());
      this.notifier.success('Profile updated');
    } catch {
      // interceptor shows error
    } finally {
      this.savingProfile.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    try {
      await this.auth.updateProfile({ currentPassword, newPassword });
      this.notifier.success('Password updated');
      this.passwordForm.reset();
    } catch {
      // interceptor shows error
    } finally {
      this.savingPassword.set(false);
    }
  }
}
