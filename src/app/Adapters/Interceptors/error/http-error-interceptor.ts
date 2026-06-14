import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from 'src/app/Infrastructure/Services/Auth/auth.service';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  // Auth endpoints manage their own outcomes (login/state return 200 with an
  // error body, logout may 401 when the session is already gone). Handling them
  // here would cause logout -> 401 -> logout loops, so we skip them.
  private readonly skipPatterns = ['/api/auth/', '/csrf-token', '/connect/'];

  constructor(
    private router: Router,
    private authService: AuthService,
    private notify: NotificationService
  ) { }

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
        this.notify.error('בעיית תקשורת עם השרת. בדקו את החיבור ונסו שוב.');
        return throwError(() => ErrorResponse);
      case 500:
        this.notify.error('אירעה שגיאה בשרת. אנא נסו שוב מאוחר יותר.');
        this.router.navigate(['/Home']);
        return throwError(() => 'Error 500');
      case 401:
      case 403:
        this.notify.warning('פג תוקף ההתחברות. אנא התחברו מחדש.');
        this.authService.doLogout().then(() => {
          this.router.navigate(['/Login']);
        });
        return throwError(() => 'Unauthorized');
      case 400:
        this.notify.errorFrom(ErrorResponse, 'הבקשה שנשלחה אינה תקינה.');
        return throwError(() => ErrorResponse);
      case 404:
        this.notify.error('המשאב המבוקש לא נמצא.');
        return throwError(() => ErrorResponse);
    }

    this.notify.errorFrom(ErrorResponse);
    return throwError(() => ErrorResponse);
  }
}
