import { DocumentDraft, DocumentDraftRow, DocumentTotals, DraftPatchOp } from './document-builder.types';

/**
 * Client-side mirror of Lus.Application/.../DraftPatcher.
 *
 * The server remains the authority — it validates, versions and persists. This exists so the
 * canvas can paint a patch the moment it arrives instead of refetching the whole draft, which
 * is what makes an agent's output appear cell-by-cell while the turn is still running.
 *
 * Deliberately total-free: totals are derived server-side and arrive as their own SetTotals
 * op, so this never computes a number the server did not.
 */
export function applyOps(draft: DocumentDraft, ops: DraftPatchOp[]): DocumentDraft {
  // Defensive on purpose: ops can arrive over SignalR before the session GET has resolved,
  // so this may run against a draft that is not fully populated yet.
  const next: DocumentDraft = {
    ...draft,
    Rows: (draft?.Rows ?? []).map(r => ({ ...r })),
    Totals: { ...(draft?.Totals ?? {}) } as DocumentDraft['Totals'],
    Template: draft?.Template ? { ...draft.Template } : null,
  };

  for (const op of ops) applyOne(next, op);
  return next;
}

function applyOne(draft: DocumentDraft, op: DraftPatchOp): void {
  switch (op.Op) {
    case 'AddRow':
      draft.Rows.push(deriveDayOfWeek(op.Value as DocumentDraftRow));
      break;
    case 'UpdateRow': {
      const index = parseRowIndex(op.Path);
      if (index < 0 || index >= draft.Rows.length) return;
      // Merge, never replace: an agent patch carries only the fields it changed.
      draft.Rows[index] = deriveDayOfWeek({
        ...draft.Rows[index],
        ...(op.Value as DocumentDraftRow),
      });
      break;
    }
    case 'RemoveRow': {
      const index = parseRowIndex(op.Path);
      if (index < 0 || index >= draft.Rows.length) return;
      draft.Rows.splice(index, 1);
      break;
    }
    case 'SetTotals':
      draft.Totals = { ...draft.Totals, ...(op.Value as DocumentTotals) };
      break;
    case 'SetField':
      applySetField(draft, op);
      break;
    default:
      // An op this client does not know is the server's business, not an error to surface.
      break;
  }
}

function applySetField(draft: DocumentDraft, op: DraftPatchOp): void {
  if (op.Path === 'lastUtterance') {
    draft.LastUtterance = (op.Value as string) ?? '';
    return;
  }
  if (op.Path === 'accountNumber' || op.Path === 'letterhead.accountNumber') {
    draft.AccountNumber = (op.Value as string) ?? null;
    return;
  }
  if (op.Path.startsWith('template.')) {
    const field = op.Path.slice('template.'.length);
    draft.Template = { ...(draft.Template ?? emptyTemplate()), [pascal(field)]: op.Value } as any;
  }
}

/** `template.dataBandStartRow` -> `DataBandStartRow`: the DTO is PascalCase, the paths are not. */
function pascal(field: string): string {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function emptyTemplate() {
  return {
    Rtl: true,
    MergeCount: 0,
    ColumnWidths: {},
    Headers: [],
    BillingLabels: [],
  };
}

function parseRowIndex(path: string): number {
  const match = /rows\[(\d+)\]/.exec(path);
  return match ? Number(match[1]) : -1;
}

/**
 * Day-of-week is derived from the date, exactly as the server derives it — so a row edited
 * on the canvas shows the right day immediately rather than after the round-trip.
 */
function deriveDayOfWeek(row: DocumentDraftRow): DocumentDraftRow {
  if (!row?.Date) return row ?? {};
  const parsed = new Date(row.Date);
  if (isNaN(parsed.getTime())) return row;
  return { ...row, DayOfWeek: parsed.getDay() + 1 };
}
