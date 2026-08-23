import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { DraftWorkbookService } from './draft-workbook.service';
import { DocumentDraft } from './document-builder.types';

function draft(overrides: Partial<DocumentDraft> = {}): DocumentDraft {
  return {
    Version: 4,
    LastUtterance: '',
    Rows: [
      { Date: '2026-03-05T00:00:00', DayOfWeek: 5, Hours: 3, Location: 'משרד', Subject: 'התייעצות' },
    ],
    Totals: { Hours: 3, CarryIn: 0, Remaining: 0, VatPercent: 18 },
    Template: null,
    ...overrides,
  };
}

describe('DraftWorkbookService', () => {
  let svc: DraftWorkbookService;

  beforeEach(() => {
    const translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: any) => key);

    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: translate }],
    });
    svc = TestBed.inject(DraftWorkbookService);
  });

  it('writes hours as a number, not text', () => {
    const sheet = svc.toWorksheet(draft());
    expect(sheet['C2'].t).toBe('n');
    expect(sheet['C2'].v).toBe(3);
  });

  it('trims the date to a plain day', () => {
    const sheet = svc.toWorksheet(draft());
    expect(sheet['A2'].v).toBe('2026-03-05');
  });

  it('defaults the sheet to RTL when no template says otherwise', () => {
    const sheet: any = svc.toWorksheet(draft());
    expect(sheet['!views'][0].RTL).toBeTrue();
  });

  it('follows the template direction rather than the UI language', () => {
    const sheet: any = svc.toWorksheet(draft({
      Template: { Rtl: false, MergeCount: 0, ColumnWidths: {}, Headers: [], BillingLabels: [] },
    }));
    expect(sheet['!views'][0].RTL).toBeFalse();
  });

  it('uses the learned column widths when the template has them', () => {
    const sheet: any = svc.toWorksheet(draft({
      Template: { Rtl: true, MergeCount: 0, ColumnWidths: { A: 25 }, Headers: [], BillingLabels: [] },
    }));
    expect(sheet['!cols'][0].wch).toBe(25);
  });

  it('writes the totals the server computed', () => {
    const sheet = svc.toWorksheet(draft({
      Totals: { Hours: 42, CarryIn: 0, Remaining: 0, VatPercent: 18 },
    }));
    const cells = Object.keys(sheet).filter(k => !k.startsWith('!'));
    const hasTotal = cells.some(k => (sheet as any)[k].v === 42);
    expect(hasTotal).toBeTrue();
  });
});
