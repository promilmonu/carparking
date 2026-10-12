import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Paged, ParkingLocation, ParkingSlot, PaginationMeta, VehicleType } from '../core/models';

export interface LocationQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  parkingType?: string;
  vehicleType?: string;
  facility?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ApiList<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

function toParams(query: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class ParkingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/parking-locations`;

  listLocations(query: LocationQuery): Observable<Paged<ParkingLocation>> {
    return this.http
      .get<ApiList<ParkingLocation>>(this.base, { params: toParams(query as Record<string, unknown>) })
      .pipe(map((r) => ({ items: r.data, meta: r.meta })));
  }

  getLocation(id: string): Observable<ParkingLocation> {
    return this.http.get<ParkingLocation>(`${this.base}/${id}`).pipe(map((r: any) => r.data ?? r));
  }

  createLocation(payload: Partial<ParkingLocation>): Promise<ParkingLocation> {
    return firstValueFrom(this.http.post<ParkingLocation>(this.base, payload).pipe(map((r: any) => r.data ?? r)));
  }

  updateLocation(id: string, payload: Partial<ParkingLocation>): Promise<ParkingLocation> {
    return firstValueFrom(this.http.put<ParkingLocation>(`${this.base}/${id}`, payload).pipe(map((r: any) => r.data ?? r)));
  }

  setLocationStatus(id: string, isActive: boolean): Promise<ParkingLocation> {
    return firstValueFrom(this.http.patch<ParkingLocation>(`${this.base}/${id}/status`, { isActive }).pipe(map((r: any) => r.data ?? r)));
  }

  deleteLocation(id: string): Promise<void> {
    return firstValueFrom(this.http.delete(`${this.base}/${id}`).pipe(map(() => undefined)));
  }

  // ===== Slots =====
  listSlots(locationId: string, query: { status?: string; vehicleType?: string; floor?: string; view?: 'grid' | 'list'; page?: number; limit?: number } = {}): Observable<ParkedSlots> {
    return this.http
      .get<ParkedSlots>(`${this.base}/${locationId}/slots`, { params: toParams(query as Record<string, unknown>) });
  }

  createSlots(locationId: string, payload: unknown): Promise<ParkingSlot[]> {
    return firstValueFrom(this.http.post<ParkingSlot[]>(`${this.base}/${locationId}/slots`, payload).pipe(map((r: any) => r.data ?? r)));
  }

  updateSlot(slotId: string, payload: Partial<ParkingSlot>): Promise<ParkingSlot> {
    return firstValueFrom(this.http.put<ParkingSlot>(`${environment.apiBaseUrl}/parking-slots/${slotId}`, payload).pipe(map((r: any) => r.data ?? r)));
  }

  setSlotStatus(slotId: string, status: string): Promise<ParkingSlot> {
    return firstValueFrom(this.http.patch<ParkingSlot>(`${environment.apiBaseUrl}/parking-slots/${slotId}/status`, { status }).pipe(map((r: any) => r.data ?? r)));
  }

  availableSlots(locationId: string, query: { vehicleType: VehicleType; startTime: string; endTime: string }): Observable<{ location: Partial<ParkingLocation>; slots: ParkingSlot[] }> {
    return this.http.get<{ location: Partial<ParkingLocation>; slots: ParkingSlot[] }>(
      `${this.base}/${locationId}/available-slots`,
      { params: toParams(query as Record<string, unknown>) }
    ).pipe(map((r: any) => r.data ?? r));
  }
}

export interface ParkedSlots {
  data?: ParkingSlot[];
  meta?: PaginationMeta | { total: number; view: string };
}
