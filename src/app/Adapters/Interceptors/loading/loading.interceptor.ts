import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Emitters } from 'src/app/Infrastructure/Emitters/Emitters';
import { CustomHttpContextTokens } from 'src/app/Infrastructure/Classes & Models/customClasses/custom-http-context-tokens';
import { HttpLoadingReporter } from 'src/app/Infrastructure/Services/ProgressReporter/http-loading.reporter';

/**
 * Successor to blockUI-request/http-request-interceptor.
 *
 * The base-URL rewrite and `withCredentials` below are load-bearing for every call in the
 * app and are carried over untouched — only the loading behaviour changed: instead of
 * attaching a full-screen CDK overlay for the life of the request, it feeds a counter that
 * surfaces as one card in the side toast, and only if the request outlives 300ms.
 *
 * Requests that drive their own progress UI (the Document Builder turn, which narrates
 * itself agent-by-agent over SignalR) opt out with the BYPASS_SPINNER context token so the
 * user is not told the same thing twice.
 */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {

  constructor(private loading: HttpLoadingReporter) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const bypassSpinner = request.context.get(CustomHttpContextTokens.BYPASS_SPINNER);
    if (!bypassSpinner) this.loading.begin();

    Emitters.isLoadingEmitter.emit(true);

    // Relative URLs are API calls; absolute ones and i18n .json assets are left alone.
    if (!request.url.endsWith('.json') && !/^https?:\/\//i.test(request.url))
      request = request.clone({
        url: `${environment.target}/${request.url}`
      });

    return next.handle(request.clone({ withCredentials: true }))
      .pipe(
        finalize(() => {
          // finalize, not tap: an errored or cancelled request must decrement too,
          // or the counter never reaches zero and the card is stuck on screen.
          if (!bypassSpinner) this.loading.end();
        })
      );
  }
}
