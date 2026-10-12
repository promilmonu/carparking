import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Booking, Paged, PaginationMeta, Pricing, VehicleType } from '../core/models';

interface ApiList<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bookings`;

  create(payload: {
    parkingLocationId: string;
    parkingSlotId: string;
    vehicleNumber: string;
    vehicleType: VehicleType;
    vehicleModel?: string;
    startTime: string;
    endTime: string;
  }): Promise<{ booking: Booking; pricing: Pricing }> {
    return firstValueFrom(this.http.post<{ booking: Booking; pricing: Pricing }>(this.base, payload));
  }

  confirm(bookingId: string, method = 'card'): Promise<Booking> {
    return firstValueFrom(this.http.patch<Booking>(`${this.base}/${bookingId}/confirm`, { method }).pipe(map((r: any) => r.data ?? r)));
  }

  cancel(bookingId: string): Promise<Booking> {
    return firstValueFrom(this.http.patch<Booking>(`${this.base}/${bookingId}/cancel`, {}).pipe(map((r: any) => r.data ?? r)));
  }

  checkIn(bookingId: string): Promise<Booking> {
    return firstValueFrom(this.http.patch<Booking>(`${this.base}/${bookingId}/check-in`, {}).pipe(map((r: any) => r.data ?? r)));
  }

  checkOut(bookingId: string): Promise<Booking> {
    return firstValueFrom(this.http.patch<Booking>(`${this.base}/${bookingId}/check-out`, {}).pipe(map((r: any) => r.data ?? r)));
  }

  get(bookingId: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.base}/${bookingId}`).pipe(map((r: any) => r.data ?? r));
  }

  myBookings(query: { page?: number; limit?: number; scope?: 'current' | 'past' | 'all'; sortBy?: string; sortOrder?: string } = {}): Observable<Paged<Booking>> {
    const params = new HttpParams({ fromObject: query as Record<string, string> });
    return this.http.get<ApiList<Booking>>(`${environment.apiBaseUrl}/users/me/bookings`, { params })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }

  allBookings(query: Record<string, unknown> = {}): Observable<Paged<Booking>> {
    const params = new HttpParams({ fromObject: query as Record<string, string> });
    return this.http.get<ApiList<Booking>>(this.base, { params }).pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }
}
