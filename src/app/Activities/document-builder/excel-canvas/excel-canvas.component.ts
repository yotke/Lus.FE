import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DocumentDraft, DocumentDraftRow } from 'src/app/Infrastructure/Services/DocumentBuilder/document-builder.types';
import { findDocumentAgent } from 'src/app/Infrastructure/Services/DocumentBuilder/document-agents.catalog';

/** One editable column of the data band. */
interface CanvasColumn {
  /** Draft field this column writes. */
  field: keyof DocumentDraftRow;
  headerKey: string;
  type: 'date' | 'number' | 'text';
  /** Derived columns render a value but refuse edits (smart concept C3). */
  derived?: boolean;
  width: string;
}

const COLUMNS: CanvasColumn[] = [
  { field: 'Date', headerKey: 'docBuilder.canvas.columns.date', type: 'date', width: '7.5rem' },
  { field: 'DayOfWeek', headerKey: 'docBuilder.canvas.columns.day', type: 'text', derived: true, width: '4rem' },
  { field: 'Hours', headerKey: 'docBuilder.canvas.columns.hours', type: 'number', width: '5rem' },
  { field: 'Location', headerKey: 'docBuilder.canvas.columns.location', type: 'text', width: '9rem' },
  { field: 'Subject', headerKey: 'docBuilder.canvas.columns.subject', type: 'text', width: 'minmax(14rem, 1fr)' },
];

/** Sunday-first, matching the server's 1-based DayOfWeek. */
const DAY_KEYS = [
  '', 'docBuilder.canvas.days.1', 'docBuilder.canvas.days.2', 'docBuilder.canvas.days.3',
  'docBuilder.canvas.days.4', 'docBuilder.canvas.days.5', 'docBuilder.canvas.days.6',
  'docBuilder.canvas.days.7',
];

/**
 * The editable Excel canvas.
 *
 * Not a preview: every cell is an input, and committing one emits the same patch op an agent
 * emits. Derived cells (day of week, every total) render but refuse edits — typing over a
 * computed number is how a document ends up disagreeing with its own arithmetic.
 *
 * Direction comes from the TEMPLATE, not the app chrome: an RTL workbook puts the first
 * column on the right no matter which language the UI is in.
 */
@Component({
  selector: 'app-excel-canvas',
  templateUrl: './excel-canvas.component.html',
  styleUrls: ['./excel-canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExcelCanvasComponent {
  @Input() draft: DocumentDraft | null = null;
  @Input() busy = false;

  @Output() cellEdit = new EventEmitter<{ rowIndex: number; patch: Record<string, unknown> }>();
  /** Billing INPUTS (rate, carry-in, VAT). Derived cells never emit this. */
  @Output() totalsEdit = new EventEmitter<{ path: string; value: number | null }>();
  @Output() addRow = new EventEmitter<void>();
  @Output() removeRow = new EventEmitter<number>();

  readonly columns = COLUMNS;

  /** Grid template built from the column widths so header and body stay aligned. */
  get gridTemplate(): string {
    return `${this.columns.map(c => c.width).join(' ')} 2.5rem`;
  }

  get dir(): 'rtl' | 'ltr' {
    return this.draft?.Template?.Rtl === false ? 'ltr' : 'rtl';
  }

  get hasTemplate(): boolean {
    return !!this.draft?.Template;
  }

  get template() {
    return this.draft?.Template ?? null;
  }

  /**
   * Column headings. The workbook's own labels win over ours — the user recognises
   * "סהכ שעות עבודה", not "שעות". Falls back to the built-in keys before an import.
   */
  get headerLabels(): { text: string | null; key: string }[] {
    const learned = this.template?.Headers ?? [];
    return this.columns.map((col, index) => ({
      text: learned[index] ?? null,
      key: col.headerKey,
    }));
  }

  /**
   * The billing block, rendered in the document's own wording where we learned it.
   * Order matches the exemplar: hours, rate, subtotal, VAT, total.
   */
  get billingLines(): { label: string | null; labelKey: string; value: string; input?: string; derived: boolean }[] {
    const totals = this.draft?.Totals;
    const learned = this.template?.BillingLabels ?? [];
    const at = (index: number) => learned[index] ?? null;

    const money = (value: number | null | undefined) =>
      value === null || value === undefined ? '' : value.toLocaleString(undefined, {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });

    const subtotal = (totals?.HourlyRate != null && totals?.Hours != null)
      ? totals.Hours * totals.HourlyRate
      : null;
    const vat = subtotal !== null ? subtotal * ((totals?.VatPercent ?? 0) / 100) : null;

    return [
      { label: at(0), labelKey: 'docBuilder.canvas.totals.hours', value: money(totals?.Hours), derived: true },
      { label: at(1), labelKey: 'docBuilder.canvas.totals.rate', value: '', input: 'totals.hourlyRate', derived: false },
      { label: at(2), labelKey: 'docBuilder.canvas.totals.subtotal', value: money(subtotal), derived: true },
      { label: at(3), labelKey: 'docBuilder.canvas.totals.vat', value: money(vat), derived: true },
      { label: at(4), labelKey: 'docBuilder.canvas.totals.total', value: money(totals?.Total), derived: true },
    ];
  }

  get rows(): DocumentDraftRow[] {
    return this.draft?.Rows ?? [];
  }

  trackByIndex(index: number): number {
    return index;
  }

  /** True when the row was last written by hand rather than by an agent. */
  isUserRow(row: DocumentDraftRow): boolean {
    return row?.Source === 'user';
  }

  /** Agents get their catalog name; a hand edit says so. Unwritten rows show nothing. */
  sourceLabelKey(row: DocumentDraftRow): string | null {
    if (!row?.Source) return null;
    if (row.Source === 'user') return 'docBuilder.canvas.source.user';
    return findDocumentAgent(row.Source)?.nameKey ?? null;
  }

  sourceIcon(row: DocumentDraftRow): string {
    if (row?.Source === 'user') return 'edit';
    return findDocumentAgent(row?.Source ?? '')?.icon ?? 'smart_toy';
  }

  /** Raw agent name, shown when the catalog has no entry for it. */
  sourceFallback(row: DocumentDraftRow): string {
    return row?.Source ?? '';
  }

  display(row: DocumentDraftRow, column: CanvasColumn): string {
    const value = row[column.field];
    if (column.field === 'DayOfWeek') return '';
    if (value === null || value === undefined) return '';
    if (column.type === 'date') return String(value).slice(0, 10);
    return String(value);
  }

  /** Day of week is shown as a localized letter, never typed. */
  dayKey(row: DocumentDraftRow): string {
    const day = row.DayOfWeek ?? 0;
    return DAY_KEYS[day] ?? '';
  }

  /**
   * The billing inputs. Kept separate from the derived totals beside them: the shipped
   * exemplar invoices bill 0.00 for real work because the rate was never entered, so the
   * rate has to be reachable here.
   */
  onTotalsCommit(path: string, raw: string, current: number | null | undefined): void {
    const trimmed = (raw ?? '').trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && isNaN(value)) return;
    if (String(current ?? '') === String(value ?? '')) return;

    this.totalsEdit.emit({ path, value });
  }

  /** A document that cannot price itself must not look finished. */
  get missingRate(): boolean {
    const totals = this.draft?.Totals;
    return !!this.draft && (totals?.HourlyRate === null || totals?.HourlyRate === undefined);
  }

  onCommit(rowIndex: number, column: CanvasColumn, raw: string): void {
    if (column.derived) return;

    const value = this.coerce(column, raw);
    const current = this.rows[rowIndex]?.[column.field] ?? null;
    // Committing an unchanged cell would spend a version for nothing.
    if (String(current ?? '') === String(value ?? '')) return;

    this.cellEdit.emit({ rowIndex, patch: { [column.field]: value } });
  }

  private coerce(column: CanvasColumn, raw: string): unknown {
    const trimmed = (raw ?? '').trim();
    if (trimmed === '') return null;
    if (column.type === 'number') {
      const parsed = Number(trimmed);
      return isNaN(parsed) ? null : parsed;
    }
    return trimmed;
  }
}
