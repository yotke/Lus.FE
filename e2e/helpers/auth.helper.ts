import { APIRequestContext, request as pwRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json');
export const E2E_USERS_FILE = path.join(__dirname, '../fixtures/e2e-users.json');

/** Lus API — not ArmyLuz on :5236. Override with API_BASE_URL. */
export const API_BASE = process.env['API_BASE_URL'] || 'http://127.0.0.1:5237';

export function loadFixtureUser(): { username: string; password: string } {
  const parsed = JSON.parse(fs.readFileSync(E2E_USERS_FILE, 'utf8')) as {
    defaultUser?: string;
    users?: Record<string, { username?: string; password?: string }>;
  };
  const key = process.env['E2E_USER'] || parsed.defaultUser || 'dev';
  const selected = parsed.users?.[key] || parsed.users?.['dev'];
  return {
    username: selected?.username || 'israel@test.com',
    password: selected?.password || 'AaUu123456@!',
  };
}

/**
 * Cookie login via Lus API: GET /csrf-token → POST /api/auth/login with X-CSRF-Token.
 * Saves Playwright storage state for reuse by API specs.
 */
export async function loginAndSaveStorageState(
  username: string,
  password: string,
  authFile = AUTH_FILE,
): Promise<void> {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE });

  const csrfRes = await ctx.get('/csrf-token');
  if (!csrfRes.ok()) {
    throw new Error(`[auth] CSRF fetch failed: ${csrfRes.status()} ${await csrfRes.text()}`);
  }
  const { token } = (await csrfRes.json()) as { token: string };

  const loginRes = await ctx.post('/api/auth/login', {
    headers: { 'X-CSRF-Token': token },
    data: { Email: username, Password: password },
    timeout: 90_000,
  });
  const loginBody = await loginRes.json();
  const ok = loginBody?.IsSuccess ?? loginBody?.isSuccess;
  if (!loginRes.ok() || !ok) {
    throw new Error(
      `[auth] Login failed (${loginRes.status()}): ${JSON.stringify(loginBody)}`,
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await ctx.storageState({ path: authFile });
  await ctx.dispose();
}

export async function authedApi(): Promise<APIRequestContext | null> {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    return pwRequest.newContext({
      baseURL: API_BASE,
      storageState: AUTH_FILE,
    });
  } catch {
    return null;
  }
}
