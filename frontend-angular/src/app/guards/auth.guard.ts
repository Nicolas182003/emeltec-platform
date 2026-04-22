import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Protege rutas que requieren autenticación (equivale a ProtectedRoute)
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) return false;

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

// Evita que usuarios autenticados vean el login (equivale a PublicRoute)
export const publicGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.loading()) return true;

  if (auth.isAuthenticated()) {
    router.navigate(['/companies']);
    return false;
  }
  return true;
};
