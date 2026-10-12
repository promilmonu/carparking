import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse, Role, User } from '../core/models';

const TOKEN_KEY = 'parking.token';
const USER_KEY = 'parking.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<User | null>(this.readUser());

  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isCustomer = computed(() => this.role() === 'customer');

  private readUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private persist(auth: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
    this.token.set(auth.token);
    this.user.set(auth.user);
  }

  async register(payload: { name: string; email: string; password: string; phone?: string }): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, payload)
    );
    this.persist(res);
    return res.user;
  }

  async login(email: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password })
    );
    this.persist(res);
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      if (this.token()) {
        await firstValueFrom(this.http.post(`${environment.apiBaseUrl}/auth/logout`, {}));
      }
    } catch {
      // token may already be invalid; clear regardless
    }
    this.clear();
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
  }

  async updateProfile(payload: { name?: string; phone?: string; currentPassword?: string; newPassword?: string }): Promise<void> {
    const user = await firstValueFrom(
      this.http.patch<User>(`${environment.apiBaseUrl}/users/me`, payload)
    );
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  homeRouteFor(): string {
    switch (this.role()) {
      case 'admin':
        return '/admin';
      case 'operator':
        return '/admin/bookings';
      default:
        return '/';
    }
  }

  async logoutAndRedirect(): Promise<void> {
    await this.logout();
    this.router.navigate(['/login']);
  }
}
