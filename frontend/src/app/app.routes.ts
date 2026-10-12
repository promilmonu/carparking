import { Routes } from '@angular/router';
import { CustomerLayoutComponent } from './layouts/customer-layout/customer-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    component: CustomerLayoutComponent,
    children: [
      { path: '', title: 'ParkEase — Find Parking', loadComponent: () => import('./features/customer/home/home.component').then((m) => m.HomeComponent) },
      { path: 'parking', title: 'Find Parking', loadComponent: () => import('./features/customer/parking-search/location-list.component').then((m) => m.CustomerLocationListComponent) },
      { path: 'parking/:id', title: 'Parking Details & Booking', loadComponent: () => import('./features/customer/booking/location-details.component').then((m) => m.LocationDetailsComponent) },
      { path: 'booking-confirmation/:id', canActivate: [authGuard], title: 'Booking Confirmation', loadComponent: () => import('./features/customer/booking/confirmation.component').then((m) => m.BookingConfirmationComponent) },
      { path: 'my-bookings', canActivate: [authGuard], title: 'My Bookings', loadComponent: () => import('./features/customer/my-bookings/my-bookings.component').then((m) => m.MyBookingsComponent) },
      { path: 'bookings/:id', canActivate: [authGuard], title: 'Booking Details', loadComponent: () => import('./features/customer/my-bookings/booking-details.component').then((m) => m.BookingDetailsComponent) },
      { path: 'profile', canActivate: [authGuard], title: 'My Profile', loadComponent: () => import('./features/customer/profile/profile.component').then((m) => m.ProfileComponent) },
    ],
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', title: 'Admin Dashboard', canActivate: [adminGuard], loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'locations', title: 'Manage Parking Locations', canActivate: [adminGuard], loadComponent: () => import('./features/admin/parking-locations/location-list.component').then((m) => m.AdminLocationListComponent) },
      { path: 'locations/new', title: 'Add Parking Location', canActivate: [adminGuard], loadComponent: () => import('./features/admin/parking-locations/location-form.component').then((m) => m.LocationFormComponent) },
      { path: 'locations/:id/edit', title: 'Edit Parking Location', canActivate: [adminGuard], loadComponent: () => import('./features/admin/parking-locations/location-form.component').then((m) => m.LocationFormComponent) },
      { path: 'slots', title: 'Manage Parking Slots', canActivate: [adminGuard], loadComponent: () => import('./features/admin/parking-slots/parking-slots.component').then((m) => m.ParkingSlotsComponent) },
      { path: 'slots/:locationId', canActivate: [adminGuard], loadComponent: () => import('./features/admin/parking-slots/parking-slots.component').then((m) => m.ParkingSlotsComponent) },
      { path: 'bookings', title: 'Manage Bookings', loadComponent: () => import('./features/admin/bookings/bookings.component').then((m) => m.BookingsComponent) },
      { path: 'customers', title: 'Manage Customers', canActivate: [adminGuard], loadComponent: () => import('./features/admin/customers/customers.component').then((m) => m.CustomersComponent) },
      { path: 'operators', title: 'Manage Operators', canActivate: [adminGuard], loadComponent: () => import('./features/admin/customers/customers.component').then((m) => m.OperatorsComponent) },
      { path: 'payments', title: 'Payments', canActivate: [adminGuard], loadComponent: () => import('./features/admin/payments/payments.component').then((m) => m.PaymentsComponent) },
      { path: 'reports', title: 'Reports', canActivate: [adminGuard], loadComponent: () => import('./features/admin/reports/reports.component').then((m) => m.ReportsComponent) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./features/admin/settings/settings.component').then((m) => m.SettingsComponent) },
    ],
  },
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      { path: 'login', title: 'Login — ParkEase', loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent) },
      { path: 'register', title: 'Sign Up — ParkEase', loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
