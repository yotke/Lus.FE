import { test, expect } from '@playwright/test';
import { authedApi } from '../helpers/api.helper';

/**
 * Document Builder — the data logic, end to end against the running API.
 *
 * Every spec resets the session to version 0 first: these run against a real user's real
 * draft, so a leftover row from a previous run would otherwise make assertions lie.
 *
 * Skips (rather than fails) when the API or auth is unavailable, matching the existing
 * API smoke spec.
 */

const BASE = '/v1/documents/builder';

type Api = NonNullable<Awaited<ReturnType<typeof authedApi>>>;

/** Undo back to an empty draft so each spec starts from the same place. */
async function resetSession(api: Api): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    const snap = await api.get(`${BASE}/session`);
    if (!snap.ok()) return false;
    const session = await snap.json();
    if ((session.Version ?? session.version) === 0) return true;
    const undo = await api.post(`${BASE}/undo`);
    if (!undo.ok()) return false;
  }
  return false;
}

async function version(api: Api): Promise<number> {
  const snap = await api.get(`${BASE}/session`);
  const session = await snap.json();
  return session.Version ?? session.version;
}

async function draft(api: Api): Promise<any> {
  const snap = await api.get(`${BASE}/session`);
  const session = await snap.json();
  return session.Draft ?? session.draft;
}

test.describe('Document Builder — data logic', () => {
  test('the agent catalog is served from the server, PascalCase', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');

    const res = await api!.get(`${BASE}/agents`);
    test.skip(res.status() === 401 || res.status() === 403, 'not authenticated');
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();

    const agents = await res.json();
    expect(Array.isArray(agents)).toBeTruthy();

    // The client mirrors these names; a rename that isn't mirrored would break the ticker.
    const names = agents.map((a: any) => a.Name);
    expect(names).toContain('doc.row_extractor');
    expect(names).toContain('doc.template_reader');
    expect(names).toContain('doc.question_planner');

    // Casing matters: the hub sends PascalCase, so the HTTP side must agree.
    expect(agents[0]).toHaveProperty('Name');
    expect(agents[0]).toHaveProperty('Icon');
    await api!.dispose();
  });

  test('answering the rate question sets the rate instead of adding a row', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    const dictate = await api!.post(`${BASE}/turn`, {
      data: { Version: 0, Text: '5 במרץ 3 שעות במשרד — התייעצות' },
    });
    test.skip(dictate.status() === 401, 'not authenticated');
    expect(dictate.ok()).toBeTruthy();

    const rowsBefore = (await draft(api!)).Rows.length;

    const answer = await api!.post(`${BASE}/turn`, {
      data: { Version: await version(api!), Text: '225', QuestionId: 'hourly_rate' },
    });
    expect(answer.ok(), `answer status ${answer.status()}`).toBeTruthy();

    const after = await draft(api!);
    expect(after.Totals.HourlyRate).toBe(225);
    expect(after.Rows.length, 'an answer must not become a work row').toBe(rowsBefore);

    await api!.dispose();
  });

  test('a canvas edit and an agent write land on one history', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });
    const beforeEdit = await draft(api!);
    expect(beforeEdit.Rows.length).toBeGreaterThan(0);
    expect(beforeEdit.Rows[0].Source, 'agent rows record the agent').toBe('doc.row_extractor');

    const edit = await api!.post(`${BASE}/canvas`, {
      data: {
        Version: await version(api!),
        Ops: [{ Op: 'UpdateRow', Path: 'rows[0]', Value: { Hours: 7 } }],
      },
    });
    expect(edit.ok(), `canvas status ${edit.status()}`).toBeTruthy();

    const edited = await draft(api!);
    expect(edited.Rows[0].Hours).toBe(7);
    expect(edited.Rows[0].Source, 'hand edits record the user').toBe('user');
    expect(edited.Totals.Hours, 'totals follow the edit').toBe(7);

    // Same history: undo reverts the hand edit.
    const undo = await api!.post(`${BASE}/undo`);
    expect(undo.ok()).toBeTruthy();
    expect((await draft(api!)).Rows[0].Hours).not.toBe(7);

    await api!.dispose();
  });

  test('derived cells refuse a direct write', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });

    const res = await api!.post(`${BASE}/canvas`, {
      data: {
        Version: await version(api!),
        Ops: [{ Op: 'SetField', Path: 'totals.hours', Value: 999 }],
      },
    });

    expect(res.status(), 'a derived cell is not writable').toBe(400);
    await api!.dispose();
  });

  test('the rate is an input and prices the document', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });

    const res = await api!.post(`${BASE}/canvas`, {
      data: {
        Version: await version(api!),
        Ops: [{ Op: 'SetField', Path: 'totals.hourlyRate', Value: 225 }],
      },
    });
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();

    const priced = await draft(api!);
    expect(priced.Totals.HourlyRate).toBe(225);
    // An empty rate must leave Total null, never 0.00 — the defect the real invoices shipped.
    expect(priced.Totals.Total).not.toBeNull();
    expect(priced.Totals.Total).toBeGreaterThan(0);

    await api!.dispose();
  });

  test('an empty rate leaves the total null rather than zero', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });

    const unpriced = await draft(api!);
    expect(unpriced.Totals.Hours).toBeGreaterThan(0);
    expect(unpriced.Totals.HourlyRate).toBeNull();
    expect(unpriced.Totals.Total, 'never 0.00 for real work').toBeNull();

    await api!.dispose();
  });

  test('a stale version is rejected, not silently applied', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });
    await api!.post(`${BASE}/turn`, { data: { Version: await version(api!), Text: '2 שעות בשטח' } });

    const stale = await api!.post(`${BASE}/canvas`, {
      data: { Version: 1, Ops: [{ Op: 'UpdateRow', Path: 'rows[0]', Value: { Hours: 99 } }] },
    });

    expect(stale.status(), 'a stale write conflicts').toBe(409);
    await api!.dispose();
  });

  test('undo then redo restores exactly what was undone', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');
    test.skip(!(await resetSession(api!)), 'could not reset session');

    await api!.post(`${BASE}/turn`, { data: { Version: 0, Text: '3 שעות במשרד' } });
    const afterTurn = await draft(api!);

    await api!.post(`${BASE}/undo`);
    expect((await draft(api!)).Rows.length).toBe(0);

    await api!.post(`${BASE}/redo`);
    const redone = await draft(api!);
    expect(redone.Rows.length).toBe(afterTurn.Rows.length);
    expect(redone.Rows[0].Hours).toBe(afterTurn.Rows[0].Hours);

    await api!.dispose();
  });
});
