import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// =============================================================================
// ThemeService — trimmed port from the Weekeye/ArmyLuz design system.
//
// Responsibilities (no organization-specific dependencies):
//   • light / dark / auto mode, persisted in localStorage
//   • follows the OS preference when mode === 'auto'
//   • sets data-theme + {light,dark}-theme classes on <html>/<body>
//     (the basicStyle/variables :root + [data-theme="dark"] blocks react to it)
//   • writes the --org-*/--theme-* brand CSS custom properties at runtime so
//     branding can be re-themed without a rebuild
//
// Consumed by app-svg-icon (semantic colors) and every component that reads the
// var(--org-*)/var(--theme-*)/var(--bg-*) custom properties.
// =============================================================================

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor?: string;
  textColor?: string;
  errorColor?: string;
  successColor?: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
  borderRadius: number;
  compactMode: boolean;
  enableAnimations: boolean;
}

const DEFAULT_THEME: ThemeConfig = {
  mode: 'auto',
  colors: {
    primaryColor: '#0F766E',
    secondaryColor: '#334155',
    accentColor: '#F59E0B',
    backgroundColor: '#f6fbfb',
    textColor: '#172033',
    errorColor: '#ef4444',
    successColor: '#10b981',
  },
  borderRadius: 8,
  compactMode: false,
  enableAnimations: true,
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'app-theme-config';
  private readonly STORAGE_MODE_KEY = 'app-theme-mode';

  private themeConfig$ = new BehaviorSubject<ThemeConfig>(DEFAULT_THEME);
  private effectiveMode$ = new BehaviorSubject<'light' | 'dark'>('light');

  public theme$: Observable<ThemeConfig> = this.themeConfig$.asObservable();
  public effectiveMode = this.effectiveMode$.asObservable();
  public isDarkMode$: Observable<boolean> = this.effectiveMode$.pipe(map(m => m === 'dark'));

  private isBrowser: boolean;
  private mediaQuery: MediaQueryList | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.initializeTheme();
      this.listenToSystemTheme();
    }
  }

  // ── Initialization ─────────────────────────────────────────────────────────
  private initializeTheme(): void {
    const savedConfig = localStorage.getItem(this.STORAGE_KEY);
    const savedMode = localStorage.getItem(this.STORAGE_MODE_KEY) as ThemeMode;

    let config = DEFAULT_THEME;
    if (savedConfig) {
      try {
        config = { ...DEFAULT_THEME, ...JSON.parse(savedConfig) };
        if (config.colors?.primaryColor?.toUpperCase() === '#1E88E5') {
          config = {
            ...config,
            colors: { ...DEFAULT_THEME.colors },
          };
        }
      } catch {
        /* ignore malformed config */
      }
    }
    if (savedMode) {
      config.mode = savedMode;
    }

    this.themeConfig$.next(config);
    this.applyTheme(config);
  }

  private listenToSystemTheme(): void {
    if (!this.isBrowser || !window.matchMedia) return;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', () => {
      if (this.themeConfig$.value.mode === 'auto') {
        this.applyTheme(this.themeConfig$.value);
      }
    });
  }

  // ── Apply ────────────────────────────────────────────────────────────────
  private applyModeToDocument(mode: 'light' | 'dark'): void {
    if (!this.isBrowser) return;
    [document.documentElement, document.body].filter(Boolean).forEach(el => {
      el.setAttribute('data-theme', mode);
      el.classList.remove('light-theme', 'dark-theme');
      el.classList.add(`${mode}-theme`);
    });
  }

  private applyTheme(config: ThemeConfig): void {
    if (!this.isBrowser) return;
    const root = document.documentElement;
    const c = config.colors;

    root.style.setProperty('--org-primary-color', c.primaryColor);
    root.style.setProperty('--org-secondary-color', c.secondaryColor);
    root.style.setProperty('--org-accent-color', c.accentColor);

    const setRgb = (name: string, hex: string) => {
      const rgb = this.hexToRgb(hex);
      if (rgb) root.style.setProperty(name, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    };
    setRgb('--org-primary-rgb', c.primaryColor);
    setRgb('--org-secondary-rgb', c.secondaryColor);
    setRgb('--org-accent-rgb', c.accentColor);

    const primaryLight = this.lightenColor(c.primaryColor, 20);
    const primaryDark = this.darkenColor(c.primaryColor, 20);
    root.style.setProperty('--org-primary-light', primaryLight);
    root.style.setProperty('--org-primary-dark', primaryDark);
    setRgb('--org-primary-light-rgb', primaryLight);
    setRgb('--org-primary-dark-rgb', primaryDark);

    root.style.setProperty('--org-primary-50', this.mixWithWhite(c.primaryColor, 10));
    root.style.setProperty('--org-primary-100', this.mixWithWhite(c.primaryColor, 20));
    root.style.setProperty('--org-primary-200', this.mixWithWhite(c.primaryColor, 40));
    root.style.setProperty('--org-primary-500', c.primaryColor);
    root.style.setProperty('--org-primary-700', this.darkenColor(c.primaryColor, 15));
    root.style.setProperty('--org-primary-900', this.darkenColor(c.primaryColor, 30));

    root.style.setProperty('--theme-primary', c.primaryColor);
    root.style.setProperty('--theme-secondary', c.secondaryColor);
    root.style.setProperty('--theme-accent', c.accentColor);
    root.style.setProperty('--theme-primary-light', primaryLight);
    root.style.setProperty('--theme-primary-dark', this.darkenColor(c.primaryColor, 15));
    root.style.setProperty('--theme-accent-light', this.lightenColor(c.accentColor, 20));
    if (c.errorColor) root.style.setProperty('--theme-error', c.errorColor);
    if (c.successColor) root.style.setProperty('--theme-success', c.successColor);

    root.style.setProperty(
      '--theme-gradient-primary',
      `linear-gradient(135deg, ${c.primaryColor} 0%, ${primaryDark} 100%)`
    );

    root.style.setProperty('--theme-border-radius', `${config.borderRadius}px`);
    root.style.setProperty('--theme-border-radius-sm', `${Math.max(4, config.borderRadius - 4)}px`);
    root.style.setProperty('--theme-border-radius-lg', `${config.borderRadius + 4}px`);

    [root, document.body].filter(Boolean).forEach(el => {
      el.classList.toggle('compact-mode', config.compactMode);
      el.classList.toggle('no-animations', !config.enableAnimations);
    });

    const effectiveMode: 'light' | 'dark' =
      config.mode === 'auto' ? (this.mediaQuery?.matches ? 'dark' : 'light') : config.mode;
    this.effectiveMode$.next(effectiveMode);
    this.applyModeToDocument(effectiveMode);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  get config(): ThemeConfig { return this.themeConfig$.value; }
  get isDark(): boolean { return this.effectiveMode$.value === 'dark'; }

  setMode(mode: ThemeMode): void {
    const config = { ...this.themeConfig$.value, mode };
    this.themeConfig$.next(config);
    this.saveConfig(config);
    this.applyTheme(config);
  }

  /** Convenience toggle for a light/dark switch button. */
  toggleDarkMode(): void {
    this.setMode(this.isDark ? 'light' : 'dark');
  }

  setColors(colors: Partial<ThemeColors>): void {
    const config = {
      ...this.themeConfig$.value,
      colors: { ...this.themeConfig$.value.colors, ...colors },
    };
    this.themeConfig$.next(config);
    this.saveConfig(config);
    this.applyTheme(config);
  }

  setBorderRadius(radius: number): void {
    const config = { ...this.themeConfig$.value, borderRadius: radius };
    this.themeConfig$.next(config);
    this.saveConfig(config);
    this.applyTheme(config);
  }

  setCompactMode(compact: boolean): void {
    const config = { ...this.themeConfig$.value, compactMode: compact };
    this.themeConfig$.next(config);
    this.saveConfig(config);
    this.applyTheme(config);
  }

  setAnimations(enabled: boolean): void {
    const config = { ...this.themeConfig$.value, enableAnimations: enabled };
    this.themeConfig$.next(config);
    this.saveConfig(config);
    this.applyTheme(config);
  }

  // ── Persistence ──────────────────────────────────────────────────────────
  private saveConfig(config: ThemeConfig): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(this.STORAGE_MODE_KEY, config.mode);
  }

  // ── Color helpers ──────────────────────────────────────────────────────────
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }

  private clamp(n: number): number { return Math.max(0, Math.min(255, Math.round(n))); }

  private toHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(v => this.clamp(v).toString(16).padStart(2, '0')).join('');
  }

  /** Lighten a hex color by `percent` (0-100). */
  private lightenColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const f = percent / 100;
    return this.toHex(rgb.r + (255 - rgb.r) * f, rgb.g + (255 - rgb.g) * f, rgb.b + (255 - rgb.b) * f);
  }

  /** Darken a hex color by `percent` (0-100). */
  private darkenColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const f = 1 - percent / 100;
    return this.toHex(rgb.r * f, rgb.g * f, rgb.b * f);
  }

  /** Mix a hex color with white; `percent` is the amount of the color kept. */
  private mixWithWhite(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    const f = percent / 100;
    return this.toHex(rgb.r * f + 255 * (1 - f), rgb.g * f + 255 * (1 - f), rgb.b * f + 255 * (1 - f));
  }
}
