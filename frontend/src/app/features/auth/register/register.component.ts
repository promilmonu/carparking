import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2>Create your account</h2>
    <p class="text-muted mb-2">Book parking spots in seconds.</p>

    <form [formGroup]="form" (ngSubmit)="submit()" class="stack">
      <mat-form-field appearance="outline">
        <mat-label>Full name</mat-label>
        <input matInput formControlName="name" autocomplete="name" />
        <mat-error>Name is required</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="email" />
        <mat-error *ngIf="form.controls.email.hasError('required')">Email is required</mat-error>
        <mat-error *ngIf="form.controls.email.hasError('email')">Enter a valid email</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Phone (optional)</mat-label>
        <input matInput formControlName="phone" autocomplete="tel" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Password</mat-label>
        <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" autocomplete="new-password" />
        <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
          <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-error *ngIf="form.controls.password.hasError('required')">Password is required</mat-error>
        <mat-error *ngIf="form.controls.password.hasError('minlength')">At least 6 characters</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Confirm password</mat-label>
        <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="confirmPassword" autocomplete="new-password" />
        <mat-error *ngIf="form.controls.confirmPassword.hasError('required')">Confirm your password</mat-error>
        <mat-error *ngIf="form.controls.confirmPassword.hasError('mismatch')">Passwords do not match</mat-error>
      </mat-form-field>

      <button mat-flat-button color="primary" class="full-width" [disabled]="loading()">
        <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
        {{ loading() ? 'Creating account…' : 'Sign up' }}
      </button>
    </form>

    <p class="mt-2" style="text-align:center">
      Already registered? <a routerLink="/login">Log in</a>
    </p>
  `,
  styles: [`
    .stack { display: flex; flex-direction: column; gap: .25rem; }
    .inline-spinner { display: inline-block; margin-right: .5rem; }
  `],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.passwordsMatch }
  );

  private passwordsMatch(group: AbstractControl): { mismatch: boolean } | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password, phone } = this.form.getRawValue();
    this.loading.set(true);
    try {
      await this.auth.register({ name, email, password, phone });
      await this.router.navigateByUrl('/');
    } catch {
      // handled by interceptor
    } finally {
      this.loading.set(false);
    }
  }
}
