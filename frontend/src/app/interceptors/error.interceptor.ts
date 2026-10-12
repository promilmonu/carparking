import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/** Global API error handling: friendly messages + auto-logout on 401. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifier = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Something went wrong. Please try again.';
      if (error.status === 0) {
        message = 'Cannot reach the API server. Is the backend running on port 5000?';
      } else if (error.error instanceof Blob) {
        message = error.statusText || message;
      } else if (typeof error.error === 'object' && error.error?.message) {
        message = error.error.message;
        const details = error.error.errors;
        if (Array.isArray(details) && details.length) {
          message += ` — ${details.map((d: any) => d.message).join('; ')}`;
        }
      } else if (error.error && typeof error.error === 'string') {
        message = error.error;
      }

      if (error.status === 401 && !req.url.endsWith('/auth/login') && !req.url.endsWith('/auth/register')) {
        auth.clear();
        router.navigate(['/login']);
        message = 'Your session has expired. Please log in again.';
      }

      notifier.error(message);
      return throwError(() => error);
    })
  );
};
