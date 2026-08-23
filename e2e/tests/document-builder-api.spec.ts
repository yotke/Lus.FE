import { test, expect } from '@playwright/test';
import { authedApi } from '../helpers/api.helper';

/**
 * Document Builder API smoke — cookie auth from auth.setup storage state.
 * Requires Lus API (default http://127.0.0.1:5237). Skips when API/login unavailable.
 */
test.describe('Document Builder — API', () => {
  test('echo round-trips Hebrew', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');

    const res = await api!.post('/v1/documents/builder/echo', {
      data: { Text: 'שלום' },
    });
    test.skip(res.status() === 401 || res.status() === 403, 'not authenticated');
    expect(res.ok(), `status ${res.status()}`).toBeTruthy();

    const body = await res.json();
    expect(body.Ok ?? body.ok).toBe(true);
    expect(body.Result?.Echo ?? body.result?.echo).toBe('שלום');
    await api!.dispose();
  });

  test('turn adds a row and undo restores version 0', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');

    // Session may carry state from prior runs — undo back to version 0 first.
    for (let i = 0; i < 20; i++) {
      const snap = await api!.get('/v1/documents/builder/session');
      if (!snap.ok()) break;
      const s = await snap.json();
      if ((s.Version ?? s.version) === 0) break;
      const undo = await api!.post('/v1/documents/builder/undo');
      if (!undo.ok()) break;
    }

    const turn = await api!.post('/v1/documents/builder/turn', {
      data: { Version: 0, Text: '5 במרץ 3 שעות במשרד — התייעצות' },
    });
    test.skip(turn.status() === 401 || turn.status() === 403, 'not authenticated');
    expect(turn.ok(), `turn status ${turn.status()}`).toBeTruthy();

    const t1 = await turn.json();
    const version = t1.Version ?? t1.version;
    const ops = t1.Ops ?? t1.ops;
    expect(version).toBeGreaterThan(0);
    expect(Array.isArray(ops)).toBeTruthy();
    expect(ops.some((o: { Op?: string; op?: string }) => (o.Op ?? o.op) === 'AddRow')).toBeTruthy();

    const undo = await api!.post('/v1/documents/builder/undo');
    expect(undo.ok()).toBeTruthy();
    const u1 = await undo.json();
    expect(u1.Version ?? u1.version).toBe(0);

    await api!.dispose();
  });

  test('session returns draft version', async () => {
    const api = await authedApi();
    test.skip(!api, 'no auth storage / API not available');

    const res = await api!.get('/v1/documents/builder/session');
    test.skip(res.status() === 401 || res.status() === 403, 'not authenticated');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof (body.Version ?? body.version)).toBe('number');
    expect(body.Draft ?? body.draft).toBeTruthy();
    await api!.dispose();
  });
});
