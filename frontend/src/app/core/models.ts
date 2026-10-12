export type Role = 'admin' | 'customer' | 'operator';
export type ParkingType = 'indoor' | 'outdoor' | 'basement' | 'multi-level';
export type VehicleType = 'two-wheeler' | 'car' | 'suv' | 'commercial';
export type Facility = 'cctv' | 'security' | 'ev-charging' | 'covered' | 'lighting' | 'wheelchair-access' | 'car-wash' | 'restroom';
export type SlotStatus = 'available' | 'reserved' | 'occupied' | 'maintenance';
export type SlotCategory = 'regular' | 'accessible' | 'ev-charging';
export type BookingStatus = 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled' | 'no-show';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ParkingLocation {
  _id: string;
  name: string;
  code: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: { lat: number | null; lng: number | null };
  parkingType: ParkingType;
  supportedVehicleTypes: VehicleType[];
  totalCapacity: number;
  totalSlots?: number;
  availableSlots?: number;
  occupiedSlots?: number;
  reservedSlots?: number;
  maintenanceSlots?: number;
  hourlyRate: number;
  dailyRate: number;
  openingTime: string;
  closingTime: string;
  facilities: Facility[];
  images: string[];
  isActive: boolean;
  floors?: string[];
  createdAt?: string;
}

export interface ParkingSlot {
  _id: string;
  slotNumber: string;
  parkingLocationId: string;
  vehicleType: VehicleType;
  floor: string;
  category: SlotCategory;
  priceCategory: string;
  status: SlotStatus;
  isActive: boolean;
  isAvailable?: boolean;
  createdAt?: string;
}

export interface Booking {
  _id: string;
  bookingReference: string;
  userId: User | string;
  parkingLocationId: ParkingLocation | string;
  parkingSlotId: ParkingSlot | string;
  slotNumber: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelledAt?: string | null;
  createdAt?: string;
}

export interface Pricing {
  billableHours: number;
  fullDays: number;
  remainingHours: number;
  hourlyRate: number;
  dailyRate: number;
  totalAmount: number;
}

export interface Payment {
  _id: string;
  bookingId: { _id: string; bookingReference: string; slotNumber: string; startTime: string; endTime: string } | string;
  userId: User | string;
  amount: number;
  currency: string;
  method: string;
  transactionId: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  paidAt: string;
  createdAt?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paged<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface DashboardStats {
  totalLocations: number;
  activeLocations: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  maintenanceSlots: number;
  activeBookings: number;
  totalCustomers: number;
  todayRevenue: number;
  todayBookings: number;
  occupancy: OccupancyReport;
}

export interface OccupancyReport {
  capacity: number;
  days: { date: string; bookings: number; revenue: number; occupancyPercent: number }[];
}

export interface RevenueReport {
  range: { from: string; to: string };
  totalRevenue: number;
  totalPayments: number;
  perDay: { date: string; revenue: number; payments: number }[];
  perLocation: { locationId: string; locationName: string; revenue: number; payments: number }[];
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
}

export const VEHICLE_TYPES: VehicleType[] = ['two-wheeler', 'car', 'suv', 'commercial'];
export const PARKING_TYPES: ParkingType[] = ['indoor', 'outdoor', 'basement', 'multi-level'];
export const FACILITIES: Facility[] = ['cctv', 'security', 'ev-charging', 'covered', 'lighting', 'wheelchair-access', 'car-wash', 'restroom'];
export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled', 'no-show'];
export const SLOT_STATUSES: SlotStatus[] = ['available', 'reserved', 'occupied', 'maintenance'];
export const SLOT_CATEGORIES: SlotCategory[] = ['regular', 'accessible', 'ev-charging'];
