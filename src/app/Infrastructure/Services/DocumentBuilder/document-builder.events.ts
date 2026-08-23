/**
 * Wire shapes for the DocumentBuilderHub events.
 *
 * Fields are PascalCase on purpose: Startup.cs configures the hub's JSON protocol with
 * `PropertyNamingPolicy = null`, so the server sends the anonymous objects in
 * DocumentBuilderEventSender verbatim. Renaming these to camelCase silently yields
 * undefined at runtime.
 */

export const DOCUMENT_BUILDER_HUB_PATH = 'hub/document-builder';

export type AgentState = 'queued' | 'running' | 'done' | 'failed';

export interface DraftPatchOpDto {
  Op: string;
  Path: string;
  Value?: unknown;
}

export interface DraftPatchedEvent {
  SessionId: string;
  Version: number;
  Ops: DraftPatchOpDto[];
  Timestamp: string;
}

export interface AgentStatusEvent {
  Agent: string;
  State: AgentState;
  Detail?: string | null;
}

export interface QuestionAskedEvent {
  Question: { Id: string; Text: string; Chips: string[] };
}

export interface BuilderMessageEvent {
  Role: 'assistant' | 'system' | string;
  Text: string;
  Suggestions?: string[] | null;
}

export interface CommitCompletedEvent {
  JobId: string;
  SessionId: string;
  OrganizationId: number;
  Counts: { [entity: string]: number };
  Warnings: { Code: string; Message: string }[];
  Timestamp: string;
}

export interface BuilderErrorEvent {
  JobId: string;
  ErrorCode: string;
  Error: string;
  Timestamp: string;
}
