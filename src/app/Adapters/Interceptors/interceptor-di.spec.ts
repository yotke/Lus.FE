import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { AuthInterceptor } from './auth.interceptors/auth.interceptor';
import { CsrfInterceptor } from './auth.interceptors/csrf.interceptor';
import { HttpErrorInterceptor } from './error/http-error-interceptor';

/**
 * THE CIRCULAR-DI LAW, EXECUTABLE.
 *
 * An HTTP interceptor must NEVER take an HttpClient-dependent service as a CONSTRUCTOR parameter.
 * Building HttpClient requires resolving HTTP_INTERCEPTORS, so any interceptor whose constructor
 * (transitively) needs HttpClient closes a loop and Angular throws:
 *
 *   NG0200: Circular dependency in DI detected for InjectionToken HTTP_INTERCEPTORS
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS: when HttpClient fails to construct, EVERY HttpClient call
 * in the app dies silently. On 2026-08-18 this shipped as "i18n is broken" — the login page
 * rendered raw keys (common.appName, auth.login.email) and the browser made ZERO requests for
 * assets/i18n/he.json, while plain <img> asset requests succeeded because they never touch
 * HttpClient.
 *
 * Three cycles existed:
 *   CsrfInterceptor      -> CsrfService      -> HttpClient
 *   HttpErrorInterceptor -> AuthService      -> HttpClient
 *   HttpErrorInterceptor -> TranslateService -> TranslateHttpLoader -> HttpClient
 *
 * All three are fixed by resolving the offending service lazily from the Injector inside the
 * interceptor rather than taking it in the constructor.
 */
describe('HTTP interceptor DI (circular-dependency law)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        // The real production registration order from app.module.ts.
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
      ],
    });
  });

  it('constructs HttpClient with the full production interceptor chain', () => {
    // The regression. Before the fix: NG0200.
    expect(() => TestBed.inject(HttpClient)).not.toThrow();
  });

  it('resolves every interceptor in the chain', () => {
    const interceptors = TestBed.inject(HTTP_INTERCEPTORS);

    expect(interceptors.some(i => i instanceof AuthInterceptor)).toBeTrue();
    expect(interceptors.some(i => i instanceof CsrfInterceptor)).toBeTrue();
    expect(interceptors.some(i => i instanceof HttpErrorInterceptor)).toBeTrue();
  });

  it('can issue a request through the constructed client', () => {
    // Constructible is not the same as usable — prove a request can actually be dispatched.
    const http = TestBed.inject(HttpClient);

    expect(() => http.get('/assets/i18n/he.json').subscribe({ error: () => { } })).not.toThrow();
  });

});
