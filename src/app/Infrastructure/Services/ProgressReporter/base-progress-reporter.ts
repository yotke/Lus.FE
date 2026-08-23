// ================================================================================
// BASE PROGRESS REPORTER - Abstract base for all domain-specific reporters
// Provides lifecycle, stage tracking, and state management.
// Subclasses only need to define config + call inherited methods from their
// SignalR subscriptions.
// ================================================================================

import { BehaviorSubject, Observable } from 'rxjs';
import {
  ProgressSnapshot,
  ProgressEvent,
  CompletionEvent,
  ErrorEvent,
  ReporterState,
  ReporterStatus,
  ReporterConfig,
} from './progress-reporter.types';

export abstract class BaseProgressReporter {
  // ---- config ----
  protected abstract get config(): ReporterConfig;

  // ---- internal state ----
  private _state = new BehaviorSubject<ReporterState>('idle');
  private _progress = new BehaviorSubject<ProgressSnapshot | null>(null);
  private _completedStages = new BehaviorSubject<string[]>([]);
  private _errorMessage = new BehaviorSubject<string>('');
  private _isExpanded = new BehaviorSubject<boolean>(false);
  private _context = new BehaviorSubject<{ [key: string]: any }>({});
  private _jobId: string | null = null;
  private _startedAt: Date | null = null;
  private _finishedAt: Date | null = null;
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- public observables ----
  readonly state$: Observable<ReporterState> = this._state.asObservable();
  readonly progress$: Observable<ProgressSnapshot | null> = this._progress.asObservable();
  readonly completedStages$: Observable<string[]> = this._completedStages.asObservable();
  readonly errorMessage$: Observable<string> = this._errorMessage.asObservable();
  readonly isExpanded$: Observable<boolean> = this._isExpanded.asObservable();
  readonly context$: Observable<{ [key: string]: any }> = this._context.asObservable();

  // ---- public accessors ----
  get key(): string { return this.config.key; }
  get workflowType(): string { return this.config.workflowType; }
  get state(): ReporterState { return this._state.value; }
  get jobId(): string | null { return this._jobId; }
  get isActive(): boolean { return this._state.value === 'active'; }
  get isCompleted(): boolean { return this._state.value === 'completed'; }
  get hasError(): boolean { return this._state.value === 'error'; }
  get isVisible(): boolean { return this._state.value !== 'idle'; }

  /** Elapsed time in ms since the reporter was started. */
  get elapsedMs(): number | null {
    if (!this._startedAt) return null;
    const end = this._finishedAt || new Date();
    return end.getTime() - this._startedAt.getTime();
  }

  /** Full snapshot for the registry / toast */
  get status(): ReporterStatus {
    return {
      key: this.config.key,
      workflowType: this.config.workflowType,
      state: this._state.value,
      progress: this._progress.value,
      completedStages: this._completedStages.value,
      errorMessage: this._errorMessage.value || undefined,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
      isExpanded: this._isExpanded.value,
      context: this._context.value,
      jobId: this._jobId || undefined,
      elapsedMs: this.elapsedMs ?? undefined,
    };
  }

  // ================================================================================
  // LIFECYCLE — called by domain services
  // ================================================================================

  /** Start tracking a new workflow. Resets all state. */
  start(message?: string, context?: { [key: string]: any }): void {
    this.clearAutoDismiss();
    this._state.next('active');
    this._progress.next(null);
    this._completedStages.next([]);
    this._errorMessage.next('');
    // startExpanded (org creation): show the stage list from the first moment, so the
    // user watches what is being created without having to click the chevron.
    this._isExpanded.next(this.config.startExpanded === true);
    this._context.next(context || {});
    this._jobId = null;
    this._startedAt = new Date();
    this._finishedAt = null;

    if (message) {
      this._progress.next({
        stage: 'starting',
        title: message,
        message: message,
        percentComplete: 0,
      });
    }
  }

  /** Feed a progress event from SignalR / HTTP polling. */
  reportProgress(event: ProgressEvent): void {
    if (this._state.value !== 'active') return;

    // Track jobId from first event
    if (event.jobId && !this._jobId) {
      this._jobId = event.jobId;
    }

    const snapshot: ProgressSnapshot = {
      stage: event.stage,
      title: event.title,
      message: event.message,
      description: event.description,
      icon: event.icon,
      percentComplete: event.percentComplete,
      details: event.details,
    };

    // Track completed stages for the detail panel
    const prev = this._progress.value;
    if (prev && prev.title && prev.title !== snapshot.title) {
      const stages = [...this._completedStages.value];
      if (!stages.includes(prev.title)) {
        stages.push(prev.title);
      }
      this._completedStages.next(stages);
    }

    this._progress.next(snapshot);
  }

  /** Mark as completed successfully. */
  complete(event?: CompletionEvent): void {
    // Record the final stage as completed
    const prev = this._progress.value;
    if (prev && prev.title) {
      const stages = [...this._completedStages.value];
      if (!stages.includes(prev.title)) {
        stages.push(prev.title);
      }
      this._completedStages.next(stages);
    }

    this._state.next('completed');
    this._finishedAt = new Date();
    this._progress.next({
      stage: 'completed',
      title: '',
      message: '',
      percentComplete: 100,
      details: event?.summary ? { summary: event.summary } : undefined,
    });

    const dismissMs = this.config.autoDismissMs ?? 8000;
    if (dismissMs > 0) {
      this.autoDismissTimer = setTimeout(() => this.dismiss(), dismissMs);
    }
  }

  /** Mark as failed with error. */
  fail(event?: ErrorEvent): void {
    this._state.next('error');
    this._finishedAt = new Date();
    this._errorMessage.next(event?.error || '');

    const dismissMs = this.config.errorDismissMs ?? 15000;
    if (dismissMs > 0) {
      this.autoDismissTimer = setTimeout(() => this.dismiss(), dismissMs);
    }
  }

  /** Reset to idle — hides the toast entry. */
  dismiss(): void {
    this.clearAutoDismiss();
    this._state.next('idle');
    this._progress.next(null);
    this._completedStages.next([]);
    this._errorMessage.next('');
    this._isExpanded.next(false);
    this._context.next({});
    this._jobId = null;
    this._startedAt = null;
    this._finishedAt = null;
  }

  // ================================================================================
  // UI INTERACTION
  // ================================================================================

  toggleExpanded(): void {
    this._isExpanded.next(!this._isExpanded.value);
  }

  collapse(): void {
    this._isExpanded.next(false);
  }

  // ================================================================================
  // INTERNAL
  // ================================================================================

  private clearAutoDismiss(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }
}
