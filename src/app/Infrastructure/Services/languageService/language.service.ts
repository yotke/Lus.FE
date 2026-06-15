import { Injectable, Injector } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DateAdapter } from '@angular/material/core';
import { BehaviorSubject } from 'rxjs';
import { LanguagesType } from './languages-type';

type Dir = 'rtl' | 'ltr';

const STORAGE_KEY = 'lang';

// ─── SINGLE SOURCE OF TRUTH FOR ALL LANGUAGE CONFIG (ArmyLuz/Weekeye pattern) ───
// To add a language: 1) add to LanguagesType  2) add an entry here  3) ship
// assets/i18n/<code>.json. Lus is Hebrew-first, so He is the default.
export interface LanguageConfig {
  code: LanguagesType;
  label: string;   // Native name shown in the language picker
  dir: Dir;        // Document direction
  locale: string;  // Material / Intl locale identifier
  active: boolean;  // Whether this language is shipped right now
}

export const LANGUAGE_CONFIG: LanguageConfig[] = [
  { code: LanguagesType.He, label: 'עברית', dir: 'rtl', locale: 'he-IL', active: true },
  { code: LanguagesType.En, label: 'English', dir: 'ltr', locale: 'en-US', active: true },
  // Ready to enable once their i18n JSON is added:
  { code: LanguagesType.Ru, label: 'Русский', dir: 'ltr', locale: 'ru-RU', active: false },
  { code: LanguagesType.Ar, label: 'العربية', dir: 'rtl', locale: 'ar-SA', active: false },
  { code: LanguagesType.Fr, label: 'Français', dir: 'ltr', locale: 'fr-FR', active: false },
  { code: LanguagesType.Es, label: 'Español', dir: 'ltr', locale: 'es-ES', active: false },
];

const ACTIVE_LANGS = LANGUAGE_CONFIG.filter(l => l.active);
const CONFIG_BY_CODE = new Map(LANGUAGE_CONFIG.map(l => [l.code, l]));
const DEFAULT_LANG = LanguagesType.He;

function isActive(code: string | null | undefined): code is LanguagesType {
  return !!CONFIG_BY_CODE.get(code as LanguagesType)?.active;
}

function configFor(code: LanguagesType): LanguageConfig {
  return CONFIG_BY_CODE.get(code) ?? CONFIG_BY_CODE.get(DEFAULT_LANG)!;
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private _lang$ = new BehaviorSubject<LanguagesType>(DEFAULT_LANG);
  readonly lang$ = this._lang$.asObservable();

  private _dir$ = new BehaviorSubject<Dir>('rtl');
  readonly dir$ = this._dir$.asObservable();

  /** Active languages you can bind to a selector. */
  readonly available = ACTIVE_LANGS;

  constructor(private translate: TranslateService, private injector: Injector) {
    this.translate.addLangs(ACTIVE_LANGS.map(l => l.code));
    this.translate.setDefaultLang(DEFAULT_LANG);
    this.applyLang(this.resolveInitialLang());
  }

  /** Set language (persists + updates TranslateService + document dir/lang). */
  setLang(lang: LanguagesType): void {
    this.applyLang(isActive(lang) ? lang : DEFAULT_LANG);
  }

  /** Toggle between Hebrew and English. */
  toggle(): void {
    this.setLang(this.current === LanguagesType.He ? LanguagesType.En : LanguagesType.He);
  }

  get current(): LanguagesType { return this._lang$.value; }
  get dir(): Dir { return this._dir$.value; }
  get locale(): string { return configFor(this._lang$.value).locale; }

  /** Synchronous translation helper for TS code. */
  instant(key: string, params?: object): string {
    return this.translate.instant(key, params);
  }

  // ----------------------- private helpers -----------------------
  private resolveInitialLang(): LanguagesType {
    const urlParam = this.getUrlLangParam();
    if (isActive(urlParam)) return urlParam;
    const saved = localStorage.getItem(STORAGE_KEY) as LanguagesType | null;
    if (isActive(saved)) return saved;
    return DEFAULT_LANG;
  }

  private applyLang(lang: LanguagesType): void {
    const cfg = configFor(lang);
    this.translate.use(lang);
    this._lang$.next(lang);
    this._dir$.next(cfg.dir);
    localStorage.setItem(STORAGE_KEY, lang);

    [document.documentElement, document.body].filter(Boolean).forEach(el => {
      el.setAttribute('lang', lang);
      el.setAttribute('dir', cfg.dir);
    });

    // Keep Material datepickers in sync (lazy to avoid circular DI).
    try {
      const dateAdapter = this.injector.get(DateAdapter, null);
      dateAdapter?.setLocale(cfg.locale);
    } catch { /* DateAdapter not available */ }
  }

  private getUrlLangParam(): LanguagesType | null {
    try {
      const p = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase();
      return (p as LanguagesType) || null;
    } catch {
      return null;
    }
  }
}
