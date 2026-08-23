/**
 * Workflow identities the progress reporters can track.
 *
 * ArmyLuz has a dozen of these (org creation, shifts, rules, crew groups...).
 * Lus has exactly two surfaces that report progress today: the Document Builder
 * turn (narrated agent-by-agent over SignalR) and plain HTTP traffic (the
 * non-blocking replacement for the old full-screen overlay). Both render through
 * the same toast stack, so both need a WorkflowType.
 */
export enum WorkflowType {
  DocumentBuilder = 'DocumentBuilder',
  HttpRequest = 'HttpRequest',
}

/**
 * Error codes the backend can put on a BuilderError event.
 * Mirrors the subset Lus actually emits (see DocumentBuilderEventSender).
 */
export enum WorkflowErrorCode {
  Unknown = 'Unknown',
  ProcessingError = 'ProcessingError',
  Cancelled = 'Cancelled',
  Timeout = 'Timeout',
  InvalidInput = 'InvalidInput',
  ValidationFailed = 'ValidationFailed',
  AiError = 'AiError',
  Unauthorized = 'Unauthorized',
  ConnectionError = 'ConnectionError',
  PythonScriptError = 'PythonScriptError',
}
