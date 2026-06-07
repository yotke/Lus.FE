import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth.service';

/**
 * Locks routes behind authentication. Re-checks the server session (cookie) on
 * every navigation so a page refresh or expired cookie correctly bounces the
 * user to the login page. Unauthenticated users are redirected to /Login with a
 * returnUrl so they land back where they intended after signing in.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.checkAuthStatus().pipe(
    map(isAuthenticated =>
      isAuthenticated
        ? true
        : router.createUrlTree(['/Login'], { queryParams: { returnUrl: state.url } })
    )
  );
};
