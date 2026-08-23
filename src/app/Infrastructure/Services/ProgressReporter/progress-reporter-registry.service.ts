// ================================================================================
// PROGRESS REPORTER REGISTRY - Central service that manages all active reporters
// The toast component subscribes to this instead of individual reporters.
// ================================================================================

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, merge, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { BaseProgressReporter } from './base-progress-reporter';
import { ReporterStatus } from './progress-reporter.types';

@Injectable({ providedIn: 'root' })
export class ProgressReporterRegistry {
  private reporters = new Map<string, BaseProgressReporter>();
  private subscriptions = new Map<string, Subscription>();

  /** All currently visible reporters (active, completed, or error — not idle). */
  private _visibleReporters = new BehaviorSubject<ReporterStatus[]>([]);
  readonly visibleReporters$: Observable<ReporterStatus[]> = this._visibleReporters.asObservable();

  /** Whether any reporter is visible (controls toast container). */
  readonly hasVisibleReporters$: Observable<boolean> = this._visibleReporters.pipe(
    map(list => list.length > 0),
    distinctUntilChanged()
  );

  /** Count of currently active (in-progress) reporters. */
  readonly activeCount$: Observable<number> = this._visibleReporters.pipe(
    map(list => list.filter(r => r.state === 'active').length),
    distinctUntilChanged()
  );

  /** Only the currently active (in-progress) reporters. */
  readonly activeReporters$: Observable<ReporterStatus[]> = this._visibleReporters.pipe(
    map(list => list.filter(r => r.state === 'active'))
  );

  /**
   * Register a reporter so its state changes are tracked.
   * Idempotent — calling again with the same key updates the reference.
   */
  register(reporter: BaseProgressReporter): void {
    const key = reporter.key;

    // Clean up existing subscription if re-registering
    this.subscriptions.get(key)?.unsubscribe();

    this.reporters.set(key, reporter);

    // Subscribe to state and progress changes to update the visible list
    const sub = merge(reporter.state$, reporter.progress$).subscribe(() => {
      this.refreshVisibleList();
    });
    this.subscriptions.set(key, sub);

    this.refreshVisibleList();
  }

  /**
   * Unregister a reporter.
   */
  unregister(key: string): void {
    this.subscriptions.get(key)?.unsubscribe();
    this.subscriptions.delete(key);
    this.reporters.delete(key);
    this.refreshVisibleList();
  }

  /**
   * Get a specific reporter by key.
   */
  get(key: string): BaseProgressReporter | undefined {
    return this.reporters.get(key);
  }

  /**
   * Get a reporter by its WorkflowType.
   */
  getByWorkflowType(workflowType: string): BaseProgressReporter | undefined {
    return Array.from(this.reporters.values()).find(r => r.workflowType === workflowType);
  }

  /**
   * Get all registered reporters.
   */
  getAll(): BaseProgressReporter[] {
    return Array.from(this.reporters.values());
  }

  /**
   * Dismiss all reporters (e.g., user clicks "clear all").
   */
  dismissAll(): void {
    this.reporters.forEach(r => r.dismiss());
  }

  private refreshVisibleList(): void {
    const visible = Array.from(this.reporters.values())
      .filter(r => r.isVisible)
      .map(r => r.status)
      // Active first, then completed, then error; within each group, most recent first
      .sort((a, b) => {
        const order = { active: 0, completed: 1, error: 2, idle: 3 };
        const diff = order[a.state] - order[b.state];
        if (diff !== 0) return diff;
        return (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0);
      });

    this._visibleReporters.next(visible);
  }
}
