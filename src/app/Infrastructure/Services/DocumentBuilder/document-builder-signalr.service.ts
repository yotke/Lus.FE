import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SignalrGenericService } from '../SignalR/signalr-generic.service';
import { DocumentBuilderReporter } from './document-builder.reporter';
import {
  DOCUMENT_AGENTS,
  findDocumentAgent,
  UNKNOWN_AGENT_ICON,
} from './document-agents.catalog';
import {
  AgentStatusEvent,
  BuilderErrorEvent,
  BuilderMessageEvent,
  CommitCompletedEvent,
  DOCUMENT_BUILDER_HUB_PATH,
  DraftPatchedEvent,
  QuestionAskedEvent,
} from './document-builder.events';

/** Pipeline length used for the percentage — disabled agents never run, so they never count. */
const ENABLED_AGENTS = DOCUMENT_AGENTS.filter(a => a.enabled);

/**
 * Turns DocumentBuilderHub events into progress the user can see.
 *
 * The hub has been emitting AgentStatus per agent since the orchestrator was written
 * (DocumentBuilderOrchestrator.cs:70) with nothing listening — this is the listener.
 * Draft patches and chat messages are re-exposed as plain observables so the canvas and
 * chat rail can consume the same connection instead of opening their own.
 */
@Injectable({ providedIn: 'root' })
export class DocumentBuilderSignalrService {
  private readonly stop$ = new Subject<void>();
  private connected = false;

  /** Patch ops for the canvas — the same stream a human cell edit will join. */
  readonly draftPatched$ = new Subject<DraftPatchedEvent>();
  readonly questionAsked$ = new Subject<QuestionAskedEvent>();
  readonly builderMessage$ = new Subject<BuilderMessageEvent>();

  constructor(
    private hub: SignalrGenericService,
    private reporter: DocumentBuilderReporter,
  ) { }

  /** Idempotent — safe to call from every screen that shows builder progress. */
  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;

    this.hub.OnHubCall('AgentStatus').pipe(takeUntil(this.stop$))
      .subscribe((e: AgentStatusEvent) => this.onAgentStatus(e));

    this.hub.OnHubCall('BuilderCommitCompleted').pipe(takeUntil(this.stop$))
      .subscribe((e: CommitCompletedEvent) => this.reporter.complete({
        jobId: e?.JobId,
        timestamp: e?.Timestamp,
        summary: e?.Counts,
      }));

    this.hub.OnHubCall('BuilderError').pipe(takeUntil(this.stop$))
      .subscribe((e: BuilderErrorEvent) => this.reporter.fail({
        jobId: e?.JobId,
        error: e?.Error,
        errorCode: e?.ErrorCode as any,
        timestamp: e?.Timestamp,
      }));

    this.hub.OnHubCall('DraftPatched').pipe(takeUntil(this.stop$))
      .subscribe((e: DraftPatchedEvent) => this.draftPatched$.next(e));

    this.hub.OnHubCall('QuestionAsked').pipe(takeUntil(this.stop$))
      .subscribe((e: QuestionAskedEvent) => this.questionAsked$.next(e));

    this.hub.OnHubCall('BuilderMessage').pipe(takeUntil(this.stop$))
      .subscribe((e: BuilderMessageEvent) => this.builderMessage$.next(e));

    await this.hub.startConnection(DOCUMENT_BUILDER_HUB_PATH);
  }

  /** Called when a turn is dispatched, so the card appears before the first agent reports. */
  beginTurn(): void {
    this.reporter.start('docBuilder.progress.starting');
  }

  /**
   * Called when the operation that started the turn returns.
   *
   * The hub only emits BuilderCommitCompleted on a COMMIT — a plain turn and a template
   * import never send it. Without this the reporter stayed 'active' forever and the toast
   * sat on the last agent's line looking hung, which is exactly what it did.
   */
  endTurn(summary?: { [entity: string]: number }): void {
    if (!this.reporter.isActive) return;
    this.reporter.complete({ jobId: '', timestamp: new Date().toISOString(), summary });
  }

  /** The operation failed before any agent reported it. */
  failTurn(message: string): void {
    if (!this.reporter.isActive) return;
    this.reporter.fail({ jobId: '', error: message, timestamp: new Date().toISOString() });
  }

  async disconnect(): Promise<void> {
    this.stop$.next();
    this.connected = false;
    await this.hub.stopConnection();
  }

  private onAgentStatus(e: AgentStatusEvent): void {
    if (!e?.Agent) return;

    // A turn can begin at the hub before the caller got its HTTP response back.
    if (!this.reporter.isActive) this.beginTurn();

    const meta = findDocumentAgent(e.Agent);
    // Titles and messages travel as i18n KEYS, not resolved strings: the toast pipes them
    // through | translate, so switching language re-renders a running turn correctly.
    // An agent added to the backend catalog but not yet mirrored here still narrates under
    // its raw name (ngx-translate echoes an unknown key) — a gap must never blank the ticker.
    const title = meta ? meta.nameKey : e.Agent;

    const position = meta ? ENABLED_AGENTS.findIndex(a => a.name === meta.name) : -1;
    const done = e.State === 'done' ? 1 : 0;
    const percent = position >= 0 && ENABLED_AGENTS.length > 0
      ? Math.round(((position + done) / ENABLED_AGENTS.length) * 100)
      : 0;

    this.reporter.reportProgress({
      jobId: '',
      stage: e.Agent,
      title,
      message: meta ? meta.descKey : '',
      description: e.Detail ?? undefined,
      icon: meta?.icon ?? UNKNOWN_AGENT_ICON,
      percentComplete: percent,
      timestamp: new Date().toISOString(),
    });

    if (e.State === 'failed') {
      this.reporter.fail({
        jobId: '',
        error: e.Detail || title,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
