import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2>Welcome back</h2>
    <p class="text-muted mb-2">Log in to book parking and manage your account.</p>

    <form [formGroup]="form" (ngSubmit)="submit()" class="stack">
      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="email" />
        <mat-icon matSuffix>mail</mat-icon>
        <mat-error *ngIf="form.controls.email.hasError('required')">Email is required</mat-error>
        <mat-error *ngIf="form.controls.email.hasError('email')">Enter a valid email</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Password</mat-label>
        <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" autocomplete="current-password" />
        <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
          <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        <mat-error>Password is required</mat-error>
      </mat-form-field>

      <button mat-flat-button color="primary" class="full-width" [disabled]="loading()">
        <mat-spinner *ngIf="loading()" diameter="20" class="inline-spinner"></mat-spinner>
        {{ loading() ? 'Signing in…' : 'Log in' }}
      </button>
    </form>

    <p class="mt-2" style="text-align:center">
      New here? <a routerLink="/register">Create an account</a>
    </p>

    <div class="demo-hint text-muted">
      <strong>Demo accounts:</strong><br/>
      admin&#64;parking.com / Admin&#64;123<br/>
      customer&#64;parking.com / Customer&#64;123
    </div>
  `,
  styles: [`
    .stack { display: flex; flex-direction: column; gap: .25rem; }
    .inline-spinner { display: inline-block; margin-right: .5rem; }
    .demo-hint { margin-top: 1.25rem; font-size: .78rem; background: #f4f6fb; border-radius: 8px; padding: .75rem; }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.login(this.form.getRawValue().email, this.form.getRawValue().password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(redirect || this.auth.homeRouteFor());
    } catch {
      // error surfaced by the global interceptor
    } finally {
      this.loading.set(false);
    }
  }
}
