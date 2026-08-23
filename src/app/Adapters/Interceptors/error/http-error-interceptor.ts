import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from 'src/app/Infrastructure/Services/Auth/auth.service';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  // Auth endpoints manage their own outcomes (login/state return 200 with an
  // error body, logout may 401 when the session is already gone). Handling them
  // here would cause logout -> 401 -> logout loops, so we skip them.
  private readonly skipPatterns = ['/api/auth/', '/csrf-token', '/connect/'];

  /**
   * CIRCULAR-DI LAW: an interceptor must NEVER take an HttpClient-dependent service as a
   * constructor parameter.
   *
   * Two of these were cycles:
   *
   *   HttpClient -> HTTP_INTERCEPTORS -> HttpErrorInterceptor -> AuthService      -> HttpClient
   *                                                           -> TranslateService -> HttpClient
   *
   * (`TranslateService`'s loader IS `TranslateHttpLoader`, which injects `HttpClient`.)
   *
   * Angular threw NG0200, HttpClient never constructed, and every HttpClient call in the app
   * silently died — the UI rendered raw i18n keys with no request for assets/i18n/he.json ever
   * appearing in the network log (2026-08-18).
   *
   * `Router` and `NotificationService` (MatSnackBar) have no HTTP dependency and stay eager.
   * Pinned by http-error-interceptor.di.spec.ts.
   */
  private authServiceRef?: AuthService;
  private translateRef?: TranslateService;

  constructor(
    private router: Router,
    private notify: NotificationService,
    private injector: Injector
  ) { }

  private get authService(): AuthService {
    return (this.authServiceRef ??= this.injector.get(AuthService));
  }

  private get translate(): TranslateService {
    return (this.translateRef ??= this.injector.get(TranslateService));
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      // retry(0),
      catchError((err) => {
        if (this.shouldSkip(request)) {
          return throwError(() => err);
        }
        return this.handleErrorResponse(err);
      })
    );
  }

  private shouldSkip(request: HttpRequest<any>): boolean {
    return this.skipPatterns.some(pattern => request.url.includes(pattern));
  }

  private handleErrorResponse(ErrorResponse: HttpErrorResponse): Observable<never> {
    switch (ErrorResponse.status) {
      case 0:
        this.notify.error(this.translate.instant('notifications.connectionError'));
        return throwError(() => ErrorResponse);
      case 500:
        this.notify.error(this.translate.instant('notifications.serverError'));
        this.router.navigate(['/Home']);
        return throwError(() => 'Error 500');
      case 401:
      case 403:
        this.notify.warning(this.translate.instant('notifications.sessionExpired'));
        this.authService.doLogout().then(() => {
          this.router.navigate(['/Login']);
        });
        return throwError(() => 'Unauthorized');
      case 400:
        this.notify.errorFrom(ErrorResponse, this.translate.instant('notifications.badRequest'));
        return throwError(() => ErrorResponse);
      case 404:
        this.notify.error(this.translate.instant('notifications.notFound'));
        return throwError(() => ErrorResponse);
    }

    this.notify.errorFrom(ErrorResponse);
    return throwError(() => ErrorResponse);
  }
}
