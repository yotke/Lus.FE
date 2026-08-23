import { Injectable } from '@angular/core';
import { BaseProgressReporter } from './base-progress-reporter';
import { ReporterConfig } from './progress-reporter.types';
import { WorkflowType } from '../SignalR/workflow-types';
import { ProgressReporterRegistry } from './progress-reporter-registry.service';

/** Nothing is shown before a request has been running this long. */
export const APPEAR_AFTER_MS = 300;
/** Once shown, the card stays at least this long so it cannot flicker. */
export const MIN_VISIBLE_MS = 400;

/**
 * The replacement for the full-screen CDK overlay: in-flight HTTP requests become
 * one card in the shared toast stack instead of a backdrop that blocks the page.
 *
 * Hysteresis is the whole point. A request that finishes in 200ms shows nothing at
 * all, and a request that does show cannot vanish in the same frame it appeared —
 * both were failure modes of the old overlay.
 *
 * Never inject HttpClient here: this reporter is driven by the interceptor, and a
 * circular dependency would break every request in the app.
 */
@Injectable({ providedIn: 'root' })
export class HttpLoadingReporter extends BaseProgressReporter {
  protected get config(): ReporterConfig {
    return {
      key: 'http-loading',
      workflowType: WorkflowType.HttpRequest,
      // Routine traffic is not an event worth reviewing — it leaves as soon as it ends.
      autoDismissMs: 1,
      errorDismissMs: 1,
    };
  }

  private pending = 0;
  private appearTimer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;

  constructor(registry: ProgressReporterRegistry) {
    super();
    registry.register(this);
  }

  /** A request went out. */
  begin(): void {
    this.pending++;
    if (this.pending === 1 && !this.appearTimer && !this.isActive) {
      this.appearTimer = setTimeout(() => {
        this.appearTimer = null;
        // Re-check: the request may have finished inside the delay window.
        if (this.pending > 0) {
          this.shownAt = Date.now();
          this.start('common.loading');
        }
      }, APPEAR_AFTER_MS);
    }
  }

  /** A request came back — success or failure, the counter does not care. */
  end(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending > 0) return;

    if (this.appearTimer) {
      // Never became visible. Cancel and leave the stack untouched.
      clearTimeout(this.appearTimer);
      this.appearTimer = null;
      return;
    }

    if (!this.isActive) return;

    const visibleFor = Date.now() - this.shownAt;
    const remaining = Math.max(0, MIN_VISIBLE_MS - visibleFor);
    setTimeout(() => {
      // Another request may have started while we were holding the card open.
      if (this.pending === 0) this.dismiss();
    }, remaining);
  }
}
