/**
 * Client mirror of Lus.Contracts/Documents/Builder.
 *
 * PascalCase throughout: the builder endpoints serialize with `JsonSerializerDefaults.Web`
 * for the HTTP payloads' outer shape but the draft DTOs keep their property names, and the
 * hub is explicitly configured with `PropertyNamingPolicy = null`. Keeping one casing for
 * both transports means an op that arrives over SignalR and one that comes back from an
 * HTTP turn are the same object.
 */

export interface DocumentDraftRow {
  Date?: string | null;
  DayOfWeek?: number | null;
  Hours?: number | null;
  Location?: string | null;
  Subject?: string | null;
  /** "user" for a hand edit, otherwise the agent that wrote it. */
  Source?: string | null;
  ChangedAt?: string | null;
}

export interface DocumentTotals {
  Hours: number;
  CarryIn: number;
  Remaining: number;
  HourlyRate?: number | null;
  VatPercent: number;
  PlotsPercent?: number | null;
  Total?: number | null;
}

/**
 * What the importer learned from the exemplar. Present as soon as a workbook is uploaded,
 * which is what lets the canvas draw an EMPTY document with the right shape before any row
 * exists.
 */
export interface DocumentTemplate {
  SheetName?: string | null;
  /** Direction of the DOCUMENT, independent of the UI language. */
  Rtl: boolean;
  DataBandStartRow?: number | null;
  TableHeaderRow?: number | null;
  TitleRow?: number | null;
  TotalsRow?: number | null;
  BillingStartRow?: number | null;
  DeclarationStartRow?: number | null;
  MergePolicy?: string | null;
  MergeCount: number;
  ColumnWidths: { [column: string]: number };
  Headers: string[];

  /** Letterhead / chrome — what makes the canvas recognisable as the user's own report. */
  OrgName?: string | null;
  Title?: string | null;
  PlannerName?: string | null;
  ClientName?: string | null;
  /** The billing block's labels, in the document's own wording. */
  BillingLabels: string[];
  DeclarationText?: string | null;
}

export interface DocumentDraft {
  Version: number;
  LastUtterance: string;
  AccountNumber?: string | null;
  Rows: DocumentDraftRow[];
  Totals: DocumentTotals;
  Template?: DocumentTemplate | null;
}

export interface DocumentBuilderSession {
  Version: number;
  Draft: DocumentDraft;
}

export interface DocumentQuestion {
  Id: string;
  Text: string;
  Chips: string[];
}

export interface DocumentWarning {
  Code: string;
  Message: string;
}

export interface DocumentBuilderMessage {
  Role: 'assistant' | 'system' | 'user' | string;
  Text: string;
  Suggestions: string[];
}

export interface DocumentBuilderTurnResponse {
  Version: number;
  Ops: DraftPatchOp[];
  Question?: DocumentQuestion | null;
  Messages: DocumentBuilderMessage[];
  Warnings: DocumentWarning[];
}

export interface DraftPatchOp {
  Op: 'SetField' | 'AddRow' | 'UpdateRow' | 'RemoveRow' | 'SetTotals' | string;
  Path: string;
  Value?: unknown;
}

export interface TemplateImportResponse {
  Version: number;
  Ops: DraftPatchOp[];
  SheetName: string;
  Rtl: boolean;
  MergeCount: number;
  DataBandStartRow: number;
}

export interface DocumentAgent {
  Name: string;
  Kind: string;
  InputKind: string;
  Icon: string;
  DisplayNameKey: string;
  DescriptionKey: string;
  Enabled: boolean;
  Wave?: number | null;
}
