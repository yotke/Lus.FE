import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx-js-style';
import { DocumentDraft, DocumentDraftRow } from './document-builder.types';

/** Column order of the data band, matching the canvas. */
const COLUMNS: { field: keyof DocumentDraftRow; headerKey: string }[] = [
  { field: 'Date', headerKey: 'docBuilder.canvas.columns.date' },
  { field: 'DayOfWeek', headerKey: 'docBuilder.canvas.columns.day' },
  { field: 'Hours', headerKey: 'docBuilder.canvas.columns.hours' },
  { field: 'Location', headerKey: 'docBuilder.canvas.columns.location' },
  { field: 'Subject', headerKey: 'docBuilder.canvas.columns.subject' },
];

const HEADER_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'EFEFEF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

/**
 * Renders a builder draft to a workbook.
 *
 * Deliberately separate from `excel-export.component.ts`: that one is the manual lane's
 * exporter, it works, and it is not this component's to change. Same library, same
 * conventions, different source — one renders a ProjectTemplate, this renders a draft.
 *
 * The template's direction drives the sheet's RTL flag, so the exported file opens the way
 * the exemplar was written regardless of the UI language.
 */
@Injectable({ providedIn: 'root' })
export class DraftWorkbookService {
  constructor(private translate: TranslateService) { }

  /** Build the sheet without writing it — the unit-testable half. */
  toWorksheet(draft: DocumentDraft): XLSX.WorkSheet {
    const header = COLUMNS.map(c => ({ v: this.translate.instant(c.headerKey), t: 's', s: HEADER_STYLE }));

    const body = (draft.Rows ?? []).map(row => COLUMNS.map(col => {
      const value = row[col.field];
      if (value === null || value === undefined || value === '') return { v: '', t: 's' };
      if (col.field === 'Hours') return { v: Number(value), t: 'n' };
      if (col.field === 'DayOfWeek') {
        const key = `docBuilder.canvas.days.${value}`;
        return { v: this.translate.instant(key), t: 's' };
      }
      if (col.field === 'Date') return { v: String(value).slice(0, 10), t: 's' };
      return { v: String(value), t: 's' };
    }));

    // Totals are derived: written as the server computed them, never recomputed here.
    const totals = draft.Totals;
    const totalsRow = [
      { v: this.translate.instant('docBuilder.canvas.totals.hours'), t: 's', s: { font: { bold: true } } },
      { v: '', t: 's' },
      { v: Number(totals?.Hours ?? 0), t: 'n', s: { font: { bold: true } } },
      { v: '', t: 's' },
      { v: '', t: 's' },
    ];

    const sheet = XLSX.utils.aoa_to_sheet([header, ...body, [], totalsRow]);

    // Column widths from the learned template where we have them, sensible defaults otherwise.
    const widths = draft.Template?.ColumnWidths ?? {};
    sheet['!cols'] = COLUMNS.map((_, index) => {
      const letter = String.fromCharCode(65 + index);
      return { wch: widths[letter] ?? (index === COLUMNS.length - 1 ? 40 : 14) };
    });

    // Direction is a property of the document, not of the app chrome.
    (sheet as any)['!views'] = [{ RTL: draft.Template?.Rtl !== false }];

    return sheet;
  }

  /** Build and hand the file to the browser. */
  download(draft: DocumentDraft, fileName?: string): void {
    const sheet = this.toWorksheet(draft);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, draft.Template?.SheetName || 'Sheet1');
    XLSX.writeFile(book, fileName || 'document.xlsx');
  }
}
