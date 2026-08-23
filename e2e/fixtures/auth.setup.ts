import { test as setup } from '@playwright/test';
import { loadFixtureUser, loginAndSaveStorageState } from '../helpers/auth.helper';

/**
 * Runs once per suite: cookie login against the Lus API (not the UI form).
 * Avoids reCAPTCHA / wrong-stack issues when :4200 or :5236 serve ArmyLuz.
 */
setup('authenticate', async () => {
  setup.setTimeout(120_000);
  const fixture = loadFixtureUser();
  const username = process.env['E2E_USERNAME'] || fixture.username;
  const password = process.env['E2E_PASSWORD'] || fixture.password;

  if (!username || !password) {
    throw new Error(
      '[auth.setup] Missing credentials. Create src/Lus.UI/.env.e2e with:\n' +
        '  E2E_USERNAME=you@example.com\n  E2E_PASSWORD=YourPassword\n',
    );
  }

  await loginAndSaveStorageState(username, password);
});
