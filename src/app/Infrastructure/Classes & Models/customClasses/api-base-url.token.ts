import { InjectionToken } from '@angular/core';
import { AppConsts } from './app-consts';

/**
 * Base URL for generated API clients.
 *
 * Lives here rather than in app.module because services inject it: importing it from the
 * module created a cycle (app.module -> components -> services -> app.module) that webpack
 * resolves to `undefined` at test time, crashing the whole Karma run with
 * "Cannot access 'CreateProjectComponent' before initialization".
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export function getBaseUrl(): string {
  return AppConsts.baseUrl;
}
