import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type AppLanguage = 'he' | 'en';

/**
 * Central language + direction management. Wraps ngx-translate, persists the
 * choice, and keeps <html dir/lang> in sync. RTL for Hebrew, LTR for English.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly STORAGE_KEY = 'app-language';
  private readonly supported: AppLanguage[] = ['he', 'en'];

  private lang$ = new BehaviorSubject<AppLanguage>('he');
  private dirSubject$ = new BehaviorSubject<'rtl' | 'ltr'>('rtl');

  /** Current language code. */
  public language$: Observable<AppLanguage> = this.lang$.asObservable();
  /** Current writing direction. */
  public dir$: Observable<'rtl' | 'ltr'> = this.dirSubject$.asObservable();

  constructor(private translate: TranslateService) {}

  get current(): AppLanguage { return this.lang$.value; }
  get dir(): 'rtl' | 'ltr' { return this.dirSubject$.value; }

  /** Call once at app startup. */
  init(): void {
    const saved = (localStorage.getItem(this.STORAGE_KEY) as AppLanguage) || 'he';
    this.translate.addLangs(this.supported);
    this.translate.setDefaultLang('he');
    this.setLanguage(this.supported.includes(saved) ? saved : 'he');
  }

  setLanguage(lang: AppLanguage): void {
    if (!this.supported.includes(lang)) return;
    this.translate.use(lang);
    const dir: 'rtl' | 'ltr' = lang === 'he' ? 'rtl' : 'ltr';
    this.lang$.next(lang);
    this.dirSubject$.next(dir);
    localStorage.setItem(this.STORAGE_KEY, lang);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', dir);
    }
  }

  toggle(): void {
    this.setLanguage(this.current === 'he' ? 'en' : 'he');
  }

  /** Synchronous translation helper for use in TS code. */
  instant(key: string, params?: object): string {
    return this.translate.instant(key, params);
  }
}
