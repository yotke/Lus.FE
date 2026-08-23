import { applyOps } from './draft-patcher';
import { DocumentDraft } from './document-builder.types';

function draft(): DocumentDraft {
  return {
    Version: 3,
    LastUtterance: '',
    Rows: [
      { Date: '2026-03-05', DayOfWeek: 5, Hours: 3, Location: 'משרד', Subject: 'התייעצות' },
      { Date: '2026-03-08', DayOfWeek: 1, Hours: 2, Location: 'שטח', Subject: 'סיור' },
    ],
    Totals: { Hours: 5, CarryIn: 0, Remaining: 0, VatPercent: 18 },
    Template: null,
  };
}

describe('applyOps', () => {
  it('does not mutate the draft it was given', () => {
    const original = draft();
    const next = applyOps(original, [{ Op: 'RemoveRow', Path: 'rows[0]' }]);

    expect(original.Rows.length).toBe(2);
    expect(next.Rows.length).toBe(1);
    expect(next).not.toBe(original);
  });

  it('merges an UpdateRow instead of replacing the row', () => {
    const next = applyOps(draft(), [
      { Op: 'UpdateRow', Path: 'rows[0]', Value: { Hours: 7 } },
    ]);

    expect(next.Rows[0].Hours).toBe(7);
    expect(next.Rows[0].Subject).withContext('untouched fields survive').toBe('התייעצות');
  });

  it('derives day of week from a new date, as the server does', () => {
    const next = applyOps(draft(), [
      { Op: 'UpdateRow', Path: 'rows[0]', Value: { Date: '2026-03-09' } },
    ]);

    // 2026-03-09 is a Monday -> getDay() 1 -> 1-based 2
    expect(next.Rows[0].DayOfWeek).toBe(2);
  });

  it('appends an AddRow', () => {
    const next = applyOps(draft(), [
      { Op: 'AddRow', Path: 'rows', Value: { Hours: 4, Subject: 'חדש' } },
    ]);

    expect(next.Rows.length).toBe(3);
    expect(next.Rows[2].Subject).toBe('חדש');
  });

  it('replaces totals from SetTotals rather than computing them', () => {
    const next = applyOps(draft(), [
      { Op: 'SetTotals', Path: 'totals', Value: { Hours: 99, CarryIn: 1, Remaining: 2, VatPercent: 18 } },
    ]);

    expect(next.Totals.Hours).toBe(99);
  });

  it('creates the template on the first template.* field', () => {
    const next = applyOps(draft(), [
      { Op: 'SetField', Path: 'template.rtl', Value: false },
      { Op: 'SetField', Path: 'template.dataBandStartRow', Value: 12 },
    ]);

    expect(next.Template).toBeTruthy();
    expect(next.Template!.Rtl).toBeFalse();
    expect(next.Template!.DataBandStartRow).toBe(12);
  });

  it('ignores an out-of-range row index instead of throwing', () => {
    const next = applyOps(draft(), [
      { Op: 'UpdateRow', Path: 'rows[99]', Value: { Hours: 1 } },
    ]);

    expect(next.Rows.length).toBe(2);
  });

  it('ignores an op it does not know', () => {
    const next = applyOps(draft(), [{ Op: 'SomethingNew', Path: 'x', Value: 1 }]);
    expect(next.Rows.length).toBe(2);
  });
});
