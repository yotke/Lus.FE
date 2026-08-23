import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { DocumentBuilderApiService } from './document-builder-api.service';
import { DocumentBuilderSignalrService } from './document-builder-signalr.service';
import { applyOps } from './draft-patcher';
import {
  DocumentBuilderMessage,
  DocumentDraft,
  DocumentQuestion,
  DocumentWarning,
  DraftPatchOp,
} from './document-builder.types';

/**
 * Normalizes a draft from the wire.
 *
 * A session persisted before a field existed, or any response missing a collection, must not
 * be able to crash the canvas — `Rows.length` on an undefined array is a blank screen, not a
 * recoverable error.
 */
function normalize(draft: Partial<DocumentDraft> | undefined, version: number): DocumentDraft {
  const base = emptyDraft();
  return {
    ...base,
    ...(draft ?? {}),
    Version: version,
    Rows: draft?.Rows ?? [],
    Totals: { ...base.Totals, ...(draft?.Totals ?? {}) },
    Template: draft?.Template ?? null,
  };
}

function emptyDraft(): DocumentDraft {
  return {
    Version: 0,
    LastUtterance: '',
    Rows: [],
    Totals: { Hours: 0, CarryIn: 0, Remaining: 0, VatPercent: 18 },
    Template: null,
  };
}

/**
 * The single source of truth the builder screen renders from.
 *
 * One draft, two writers — the chat and the canvas — and they converge because both go
 * through the server's patcher and come back as ops. Live ops also arrive over SignalR
 * while a turn is still running, which is what makes the document fill in cell by cell.
 */
@Injectable({ providedIn: 'root' })
export class BuilderStateService {
  private readonly _draft = new BehaviorSubject<DocumentDraft>(emptyDraft());
  private readonly _messages = new BehaviorSubject<DocumentBuilderMessage[]>([]);
  private readonly _question = new BehaviorSubject<DocumentQuestion | null>(null);
  private readonly _warnings = new BehaviorSubject<DocumentWarning[]>([]);
  private readonly _busy = new BehaviorSubject<boolean>(false);
  private readonly _error = new BehaviorSubject<string | null>(null);

  readonly draft$ = this._draft.asObservable();
  readonly messages$ = this._messages.asObservable();
  readonly question$ = this._question.asObservable();
  readonly warnings$ = this._warnings.asObservable();
  readonly busy$ = this._busy.asObservable();
  readonly error$ = this._error.asObservable();

  get draft(): DocumentDraft { return this._draft.value; }
  get version(): number { return this._draft.value.Version; }

  constructor(
    private api: DocumentBuilderApiService,
    private hub: DocumentBuilderSignalrService,
  ) { }

  /** Load the session and start listening for live patches. Safe to call repeatedly. */
  async init(): Promise<void> {
    await this.hub.connect();

    this.hub.draftPatched$.subscribe(e => {
      // Ops for a version we already hold (our own turn's HTTP response beat the event)
      // must not be applied twice.
      if (!e || e.Version <= this._draft.value.Version) return;
      this._draft.next({ ...applyOps(this._draft.value, e.Ops as DraftPatchOp[]), Version: e.Version });
    });

    this.hub.questionAsked$.subscribe(e => {
      if (e?.Question) this._question.next(e.Question);
    });

    this.hub.builderMessage$.subscribe(e => {
      if (!e?.Text) return;
      this.pushMessage({ Role: e.Role, Text: e.Text, Suggestions: e.Suggestions ?? [] });
    });

    const session = await firstValueFrom(this.api.session());
    this._draft.next(normalize(session?.Draft, session?.Version ?? 0));
  }

  /** Dictate, ask, or answer the planner's question. */
  async say(text: string): Promise<void> {
    const trimmed = (text ?? '').trim();
    if (!trimmed || this._busy.value) return;

    this.pushMessage({ Role: 'user', Text: trimmed, Suggestions: [] });
    // Captured BEFORE clearing: this is what makes the reply an answer to that question
    // rather than a fresh instruction.
    const answering = this._question.value?.Id ?? null;
    // The question was just answered; clear it so the chips cannot be clicked twice.
    this._question.next(null);
    this._busy.next(true);
    this._error.next(null);
    this.hub.beginTurn();

    try {
      const result = await firstValueFrom(this.api.turn(this.version, trimmed, answering));
      this.absorb(result.Version, result.Ops);
      this._warnings.next(result.Warnings ?? []);
      if (result.Question) this._question.next(result.Question);
      for (const message of result.Messages ?? []) this.pushMessage(message);
      this.hub.endTurn({ rows: this._draft.value.Rows?.length ?? 0 });
    } catch (error) {
      const described = this.describe(error);
      this._error.next(described);
      this.hub.failTurn(described);
    } finally {
      this._busy.next(false);
    }
  }

  /**
   * A cell edit. Emits the same op an agent emits — the law that keeps hand edits and agent
   * edits on one history. A 409 means an agent moved the draft under us: re-sync rather than
   * clobber.
   */
  async editCell(rowIndex: number, patch: Partial<Record<string, unknown>>): Promise<void> {
    const op: DraftPatchOp = { Op: 'UpdateRow', Path: `rows[${rowIndex}]`, Value: patch };
    await this.sendOps([op]);
  }

  /**
   * A billing INPUT — rate, carry-in, VAT. Same op path as any other edit; the server's
   * guard is what decides which totals paths are inputs and which are derived.
   */
  async editTotalsInput(path: string, value: number | null): Promise<void> {
    await this.sendOps([{ Op: 'SetField', Path: path, Value: value }]);
  }

  /**
   * Refuses an export the document cannot stand behind. An unpriced report is exactly the
   * defect the real exemplars shipped with: 32 hours billed at 0.00.
   */
  canExport(): boolean {
    // Emptiness first: telling someone to enter a rate for a document with no rows in it
    // is the wrong complaint about the wrong problem.
    if (!this._draft.value.Rows?.length) {
      this._error.next('docBuilder.errors.emptyDocument');
      return false;
    }
    const totals = this._draft.value.Totals;
    if (totals?.HourlyRate === null || totals?.HourlyRate === undefined) {
      this._error.next('docBuilder.errors.missingRate');
      return false;
    }
    this._error.next(null);
    return true;
  }

  async addRow(): Promise<void> {
    await this.sendOps([{ Op: 'AddRow', Path: 'rows', Value: {} }]);
  }

  async removeRow(rowIndex: number): Promise<void> {
    await this.sendOps([{ Op: 'RemoveRow', Path: `rows[${rowIndex}]` }]);
  }

  /** Hand the exemplar to the importer; the template lands on the draft as patches. */
  async uploadExemplar(file: File): Promise<void> {
    this._busy.next(true);
    this._error.next(null);
    this.hub.beginTurn();
    try {
      const result = await firstValueFrom(this.api.uploadExemplar(file));
      this.absorb(result.Version, result.Ops);
      this.hub.endTurn({ rows: this._draft.value.Rows?.length ?? 0 });
    } catch (error) {
      const described = this.describe(error);
      this._error.next(described);
      this.hub.failTurn(described);
    } finally {
      this._busy.next(false);
    }
  }

  async undo(): Promise<void> {
    const result = await firstValueFrom(this.api.undo());
    this.absorb(result.Version, result.Ops);
  }

  async redo(): Promise<void> {
    const result = await firstValueFrom(this.api.redo());
    this.absorb(result.Version, result.Ops);
  }

  private async sendOps(ops: DraftPatchOp[]): Promise<void> {
    if (this._busy.value) return;
    this._busy.next(true);
    this._error.next(null);
    try {
      const result = await firstValueFrom(this.api.canvasEdit(this.version, ops));
      this.absorb(result.Version, result.Ops);
    } catch (error: any) {
      if (error?.status === 409) {
        // Someone else advanced the draft. The server's copy wins; re-read it.
        await this.resync();
        return;
      }
      this._error.next(this.describe(error));
    } finally {
      this._busy.next(false);
    }
  }

  private async resync(): Promise<void> {
    const session = await firstValueFrom(this.api.session());
    this._draft.next(normalize(session?.Draft, session?.Version ?? 0));
  }

  private absorb(version: number, ops: DraftPatchOp[] | undefined): void {
    if (!ops?.length) {
      if (version > this._draft.value.Version)
        this._draft.next({ ...this._draft.value, Version: version });
      return;
    }
    this._draft.next({ ...applyOps(this._draft.value, ops), Version: version });
  }

  private pushMessage(message: DocumentBuilderMessage): void {
    this._messages.next([...this._messages.value, message]);
  }

  private describe(error: any): string {
    return error?.error?.Error || error?.message || 'docBuilder.errors.generic';
  }
}
