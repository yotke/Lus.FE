import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomHttpContextTokens } from 'src/app/Infrastructure/Classes & Models/customClasses/custom-http-context-tokens';
import {
  DocumentAgent,
  DocumentBuilderSession,
  DocumentBuilderTurnResponse,
  DraftPatchOp,
  TemplateImportResponse,
} from './document-builder.types';

const BASE = 'v1/documents/builder';

/**
 * HTTP surface of the Document Builder.
 *
 * Every long call sets BYPASS_SPINNER: these operations narrate themselves agent-by-agent
 * through the progress toast, and letting the generic HTTP loader also report them would
 * tell the user the same thing twice.
 */
@Injectable({ providedIn: 'root' })
export class DocumentBuilderApiService {
  constructor(private http: HttpClient) { }

  private narrated(): HttpContext {
    return new HttpContext().set(CustomHttpContextTokens.BYPASS_SPINNER, true);
  }

  session(): Observable<DocumentBuilderSession> {
    return this.http.get<DocumentBuilderSession>(`${BASE}/session`);
  }

  /** The catalog the server actually dispatches — the client never guesses it. */
  agents(): Observable<DocumentAgent[]> {
    return this.http.get<DocumentAgent[]>(`${BASE}/agents`);
  }

  /**
   * A conversational turn: dictation, or an answer to the planner's question.
   *
   * `questionId` is what tells the server the message is an ANSWER — without it "225" is
   * indistinguishable from a new line of dictation and gets fed to the row extractor.
   */
  turn(version: number, text: string, questionId?: string | null): Observable<DocumentBuilderTurnResponse> {
    return this.http.post<DocumentBuilderTurnResponse>(
      `${BASE}/turn`,
      { Version: version, Text: text, QuestionId: questionId ?? null },
      { context: this.narrated() });
  }

  /** A hand edit on the canvas — same op shape an agent emits. */
  canvasEdit(version: number, ops: DraftPatchOp[]): Observable<DocumentBuilderTurnResponse> {
    return this.http.post<DocumentBuilderTurnResponse>(
      `${BASE}/canvas`, { Version: version, Ops: ops });
  }

  /** Upload an exemplar workbook for the importer to learn. */
  uploadExemplar(file: File): Observable<TemplateImportResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<TemplateImportResponse>(
      `${BASE}/upload`, form, { context: this.narrated() });
  }

  undo(): Observable<DocumentBuilderTurnResponse> {
    return this.http.post<DocumentBuilderTurnResponse>(`${BASE}/undo`, {});
  }

  redo(): Observable<DocumentBuilderTurnResponse> {
    return this.http.post<DocumentBuilderTurnResponse>(`${BASE}/redo`, {});
  }
}
