// ================================================================================
// PROGRESS REPORTER TYPES - Generic types for all workflow progress reporting
// Used by BaseProgressReporter and ProgressReporterRegistry
// ================================================================================

import { WorkflowType, WorkflowErrorCode } from '../SignalR/workflow-types';

/**
 * A snapshot of a single workflow's progress at a point in time.
 * Domain-agnostic — works for org creation, shifts, rules, crew groups, etc.
 */
export interface ProgressSnapshot {
  /** Current stage identifier (domain-specific enum value) */
  stage: string;
  /** Localized short title (e.g., "מעבד תפקידים") */
  title: string;
  /** Localized longer description */
  message: string;
  /** Additional context paragraph from backend */
  description?: string;
  /** Material icon name to show */
  icon?: string;
  /** 0–100 percentage */
  percentComplete: number;
  /** Domain-specific details (entity counts, etc.) */
  details?: ProgressDetails;
}

export interface ProgressDetails {
  count?: number;
  current?: number;
  entityType?: string;
  [key: string]: any;
}

/**
 * State of a tracked reporter — what the toast/UI needs to render.
 */
export type ReporterState = 'idle' | 'active' | 'completed' | 'error';

/**
 * Full state for a single reporter, exposed to the registry and toast.
 */
export interface ReporterStatus {
  /** Unique key for this reporter (e.g., 'organization-creation', 'create-shift') */
  key: string;
  /** Human-readable workflow type label */
  workflowType: WorkflowType | string;
  /** Current lifecycle state */
  state: ReporterState;
  /** Latest progress snapshot */
  progress: ProgressSnapshot | null;
  /** List of completed stage titles */
  completedStages: string[];
  /** Error message if state === 'error' */
  errorMessage?: string;
  /** Error code from backend */
  errorCode?: WorkflowErrorCode;
  /** When this reporter was started */
  startedAt: Date | null;
  /** When this reporter finished (completed or error) */
  finishedAt: Date | null;
  /** Whether the toast detail panel is expanded */
  isExpanded: boolean;
  /** Optional context: entity being created, organization ID, etc. */
  context?: { [key: string]: any };
  /** Current jobId being tracked */
  jobId?: string;
  /** Elapsed time in ms since start (null if not started) */
  elapsedMs?: number;
}

/**
 * Configuration for a reporter, used when registering.
 */
export interface ReporterConfig {
  /** Unique key */
  key: string;
  /** WorkflowType enum or custom string */
  workflowType: WorkflowType | string;
  /** Auto-dismiss after completion (ms). 0 = no auto-dismiss. Default: 8000 */
  autoDismissMs?: number;
  /** Auto-dismiss after error (ms). 0 = no auto-dismiss. Default: 15000 */
  errorDismissMs?: number;
  /** Open the detail panel (stage list) as soon as the workflow starts.
   * Org creation sets this: the stage-by-stage narration IS the product there. */
  startExpanded?: boolean;
}

/**
 * Input from any SignalR progress event — normalized to a common shape.
 */
export interface ProgressEvent {
  jobId: string;
  stage: string;
  title: string;
  message: string;
  description?: string;
  icon?: string;
  percentComplete: number;
  timestamp: string;
  details?: ProgressDetails;
}

/**
 * Input from any SignalR completion event — normalized.
 */
export interface CompletionEvent {
  jobId: string;
  result?: any;
  timestamp: string;
  summary?: { [entityType: string]: number };
}

/**
 * Input from any SignalR error event — normalized.
 */
export interface ErrorEvent {
  jobId: string;
  error: string;
  errorCode?: WorkflowErrorCode;
  timestamp: string;
}
