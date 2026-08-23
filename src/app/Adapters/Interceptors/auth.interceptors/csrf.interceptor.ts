import { Injectable, Injector } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { CsrfService } from 'src/app/Infrastructure/Services/Auth/csrf.service';

const METHODS_REQUIRING_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_SKIP = ['/csrf-token', '/connect/'];

@Injectable()
export class CsrfInterceptor implements HttpInterceptor {
  /**
   * CIRCULAR-DI LAW: an interceptor must NEVER take an HttpClient-dependent service as a
   * constructor parameter.
   *
   * `CsrfService` injects `HttpClient`. Taking it here created:
   *
   *   HttpClient -> HTTP_INTERCEPTORS -> CsrfInterceptor -> CsrfService -> HttpClient
   *                                                              ^_____________|
   *
   * Angular threw NG0200 and HttpClient never constructed, so EVERY HttpClient call in the app
   * silently died — including @ngx-translate's loader, which is why the UI rendered raw keys
   * ("common.appName", "auth.login.email") with no request for assets/i18n/he.json ever appearing
   * in the network log (2026-08-18).
   *
   * The Injector is resolved eagerly (it has no HTTP dependency); `CsrfService` is pulled lazily
   * on first use, by which time HttpClient exists. Pinned by csrf.interceptor.di.spec.ts.
   */
  private csrfService?: CsrfService;

  constructor(private injector: Injector) { }

  private get csrf(): CsrfService {
    return (this.csrfService ??= this.injector.get(CsrfService));
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.shouldAddCsrf(req)) {
      return next.handle(req);
    }

    return this.csrf.getToken().pipe(
      take(1),
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('Missing CSRF token'));
        }

        return next.handle(req.clone({ setHeaders: { 'X-CSRF-Token': token } }));
      }),
      catchError(error => {
        if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 403)) {
          return this.csrf.refreshToken().pipe(
            take(1),
            switchMap(token => {
              if (!token) {
                return throwError(() => error);
              }

              return next.handle(req.clone({ setHeaders: { 'X-CSRF-Token': token } }));
            })
          );
        }

        return throwError(() => error);
      })
    );
  }

  private shouldAddCsrf(req: HttpRequest<any>): boolean {
    if (!METHODS_REQUIRING_CSRF.has(req.method.toUpperCase())) {
      return false;
    }

    if (CSRF_SKIP.some(url => req.url.includes(url))) {
      return false;
    }

    if (req.headers.has('Authorization')) {
      return false;
    }

    const apiBase = environment.target.replace(/\/+$/, '');
    return req.url.startsWith(apiBase) || req.url.startsWith('/api');
  }
}
