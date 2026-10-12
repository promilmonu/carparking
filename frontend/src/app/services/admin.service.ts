import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Booking, DashboardStats, OccupancyReport, Paged, PaginationMeta, Payment, RevenueReport, Role, User,
} from '../core/models';

interface ApiList<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  dashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/dashboard`).pipe(map((r: any) => r.data ?? r));
  }

  occupancyReport(days = 7, locationId?: string): Observable<OccupancyReport> {
    let params = new HttpParams().set('days', String(days));
    if (locationId) params = params.set('locationId', locationId);
    return this.http.get<OccupancyReport>(`${this.base}/reports/occupancy`, { params }).pipe(map((r: any) => r.data ?? r));
  }

  revenueReport(query: { from?: string; to?: string; locationId?: string } = {}): Observable<RevenueReport> {
    const params = new HttpParams({ fromObject: query as Record<string, string> });
    return this.http.get<RevenueReport>(`${this.base}/reports/revenue`, { params }).pipe(map((r: any) => r.data ?? r));
  }

  users(query: { page?: number; limit?: number; role?: Role | string; search?: string; isActive?: boolean } = {}): Observable<Paged<User>> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') clean[k] = v;
    return this.http.get<ApiList<User>>(`${this.base}/users`, { params: new HttpParams({ fromObject: clean as Record<string, string> }) })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }

  setUserStatus(id: string, isActive: boolean): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${this.base}/users/${id}/status`, { isActive }).pipe(map((r: any) => r.data ?? r)));
  }

  setUserRole(id: string, role: Role): Promise<User> {
    return firstValueFrom(this.http.patch<User>(`${this.base}/users/${id}/role`, { role }).pipe(map((r: any) => r.data ?? r)));
  }

  payments(query: Record<string, unknown> = {}): Observable<Paged<Payment>> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') clean[k] = v;
    return this.http.get<ApiList<Payment>>(`${environment.apiBaseUrl}/payments`, { params: new HttpParams({ fromObject: clean as Record<string, string> }) })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }

  auditLogs(page = 1, limit = 20): Observable<Paged<any>> {
    return this.http.get<ApiList<any>>(`${this.base}/audit-logs`, { params: { page, limit } })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }
}
