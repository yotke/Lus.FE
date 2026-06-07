import { Inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

/**
 * Dynamically loads the TabNav accessibility widget **once** and keeps it in
 * sync with the application primary color. The widget button is also
 * dismissible / restorable, and its visibility is persisted in localStorage.
 *
 * Ported from the ArmyLuz project and adapted for Lus.UI, which is a single
 * direction (RTL / Hebrew) application without a dedicated theme/language
 * service: the direction is read from the document and the primary color from
 * the --org-primary-color CSS variable (with a sensible fallback).
 */
@Injectable({ providedIn: 'root' })
export class TabNavWidgetService implements OnDestroy {

  private static readonly SCRIPT_ID = 'tabnav-widget-script';
  private static readonly NOSCRIPT_ID = 'tabnav-widget-noscript';
  private static readonly DISMISS_BTN_ID = 'tabnav-dismiss-btn';
  private static readonly RESTORE_BTN_ID = 'tabnav-restore-btn';
  private static readonly STYLE_ID = 'tabnav-custom-styles';
  private static readonly WIDGET_BASE_URL =
    'https://widget.tabnav.com/limited-widget.min.js.gz?req=RL7J_5VC66MD_Gqko1auz9KuyA';

  private static readonly POS_KEY = 'tabnav-btn-position';
  private static readonly HIDDEN_KEY = 'tabnav-btn-hidden';
  private static readonly FALLBACK_COLOR = '#3f51b5';

  private readonly isBrowser: boolean;
  private currentDir: 'rtl' | 'ltr' = 'rtl';
  private pollTimer: any = null;
  private injected = false;
  private patched = false;

  public hidden$ = new BehaviorSubject<boolean>(false);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.currentDir = this.resolveDir();
      this.hidden$.next(localStorage.getItem(TabNavWidgetService.HIDDEN_KEY) === 'true');
      this.injectStyles();
      this.injectScriptOnce();
      this.startPollingForButton();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ───────────────────────────────────────────────────────────────────────────

  hideWidget(): void {
    if (!this.isBrowser) return;
    this.hidden$.next(true);
    localStorage.setItem(TabNavWidgetService.HIDDEN_KEY, 'true');
    this.applyVisibility();
  }

  showWidget(): void {
    if (!this.isBrowser) return;
    this.hidden$.next(false);
    localStorage.removeItem(TabNavWidgetService.HIDDEN_KEY);
    this.applyVisibility();
  }

  toggleWidget(): void {
    this.hidden$.value ? this.showWidget() : this.hideWidget();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  private resolveDir(): 'rtl' | 'ltr' {
    const dir = document.documentElement.getAttribute('dir')
      || document.body.getAttribute('dir');
    return dir === 'ltr' ? 'ltr' : 'rtl';
  }

  private resolvePrimaryColor(): string {
    const fromVar = getComputedStyle(document.documentElement)
      .getPropertyValue('--org-primary-color')
      .trim();
    return fromVar || TabNavWidgetService.FALLBACK_COLOR;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCRIPT INJECTION — exactly once
  // ───────────────────────────────────────────────────────────────────────────

  private injectScriptOnce(): void {
    if (this.injected) return;
    this.injected = true;

    const color = this.resolvePrimaryColor();
    const widgetSide = this.currentDir === 'rtl' ? 'left' : 'right';

    const config = JSON.stringify({
      language: 'us-en',
      color,
      buttonColor: color,
      buttonSize: 'small',
      widgetSize: 'small',
      widgetLocation: widgetSide,
      buttonLocation: 'bottom'
    });

    const script = document.createElement('script');
    script.id = TabNavWidgetService.SCRIPT_ID;
    script.src = TabNavWidgetService.WIDGET_BASE_URL;
    script.defer = true;
    script.setAttribute('tnv-data-config', config);
    document.head.appendChild(script);

    const noscript = document.createElement('noscript');
    noscript.id = TabNavWidgetService.NOSCRIPT_ID;
    noscript.innerHTML =
      'JavaScript is required for <a href="https://tabnav.com/accessibility-widget">tabnav widget</a> to work properly.';
    document.body.appendChild(noscript);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POLL FOR BUTTON
  // ───────────────────────────────────────────────────────────────────────────

  private startPollingForButton(): void {
    let attempts = 0;
    this.pollTimer = setInterval(() => {
      attempts++;
      if (this.tryPatchButton() || attempts >= 30) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }, 500);
  }

  private tryPatchButton(): boolean {
    if (this.patched) return true;

    const btn = document.querySelector('.tr-button') as HTMLElement | null;
    if (!btn) return false;

    this.patched = true;

    this.addDismissButton(btn);
    this.addRestoreButton();
    this.restoreSavedPosition(btn);
    this.setDefaultPositionForDir(btn);
    this.applyVisibility();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DISMISS / RESTORE
  // ───────────────────────────────────────────────────────────────────────────

  private addDismissButton(widgetBtn: HTMLElement): void {
    if (document.getElementById(TabNavWidgetService.DISMISS_BTN_ID)) return;

    const el = document.createElement('button');
    el.id = TabNavWidgetService.DISMISS_BTN_ID;
    el.className = 'tabnav-dismiss';
    el.setAttribute('aria-label', 'Hide accessibility widget');
    el.title = 'Hide accessibility widget';
    el.innerHTML = '&times;';
    el.addEventListener('click', (e) => { e.stopPropagation(); this.hideWidget(); });
    document.body.appendChild(el);
    this.repositionDismissButton(widgetBtn);
  }

  private repositionDismissButton(widgetBtn: HTMLElement): void {
    const el = document.getElementById(TabNavWidgetService.DISMISS_BTN_ID) as HTMLElement | null;
    if (!el) return;
    const r = widgetBtn.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.top = `${r.top - 6}px`;
    el.style.zIndex = '1000';
    el.style.left = this.currentDir === 'rtl' ? `${r.left - 6}px` : `${r.right - 6}px`;
    el.style.right = 'auto';
  }

  private addRestoreButton(): void {
    if (document.getElementById(TabNavWidgetService.RESTORE_BTN_ID)) return;

    const el = document.createElement('button');
    el.id = TabNavWidgetService.RESTORE_BTN_ID;
    el.className = 'tabnav-restore';
    el.setAttribute('aria-label', 'Show accessibility widget');
    el.title = 'Show accessibility widget';
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M5.1 8.08c-.22 2.54-.82 5-1.74 7.39a.87.87 0 0 0 .67 1.46.87.87 0 0 0 .82-.66 38 38 0 0 0 1.49-5.17c.33 1.78.83 3.5 1.49 5.17a.87.87 0 0 0 1.48.66.87.87 0 0 0 .67-1.46 38 38 0 0 1-1.74-7.39c1.46-.35 2.86-.66 4.1-1.05a.87.87 0 0 0-.33-1.7c-1.86.3-3.13 1.09-5.68 1.09s-3.83-.79-5.69-1.09a.87.87 0 0 0-.33 1.7c1.24.39 2.64.7 4.1 1.05Z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M8.56 2.16a2.06 2.06 0 1 1-4.12 0 2.06 2.06 0 0 1 4.12 0Z" fill="currentColor"/>
    </svg>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); this.showWidget(); });
    document.body.appendChild(el);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VISIBILITY
  // ───────────────────────────────────────────────────────────────────────────

  private applyVisibility(): void {
    const hidden = this.hidden$.value;

    document.querySelectorAll<HTMLElement>('.tr-button, [id^="tr-button"]')
      .forEach(el => el.style.display = hidden ? 'none' : '');

    const dismiss = document.getElementById(TabNavWidgetService.DISMISS_BTN_ID) as HTMLElement | null;
    if (dismiss) dismiss.style.display = hidden ? 'none' : '';

    const restore = document.getElementById(TabNavWidgetService.RESTORE_BTN_ID) as HTMLElement | null;
    if (restore) restore.style.display = hidden ? '' : 'none';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POSITION
  // ───────────────────────────────────────────────────────────────────────────

  private restoreSavedPosition(btn: HTMLElement): void {
    const raw = localStorage.getItem(TabNavWidgetService.POS_KEY);
    if (!raw) return;
    try {
      const { x, y } = JSON.parse(raw);
      const w = btn.offsetWidth, h = btn.offsetHeight;
      btn.style.position = 'fixed';
      btn.style.left = `${Math.min(Math.max(0, x), window.innerWidth - w)}px`;
      btn.style.top = `${Math.min(Math.max(0, y), window.innerHeight - h)}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      this.repositionDismissButton(btn);
    } catch { /* ignore */ }
  }

  private setDefaultPositionForDir(btn: HTMLElement): void {
    if (localStorage.getItem(TabNavWidgetService.POS_KEY)) return;
    const margin = 16;
    btn.style.position = 'fixed';
    btn.style.bottom = `${margin}px`;
    btn.style.top = 'auto';
    if (this.currentDir === 'rtl') {
      btn.style.left = `${margin}px`;
      btn.style.right = 'auto';
    } else {
      btn.style.right = `${margin}px`;
      btn.style.left = 'auto';
    }
    this.repositionDismissButton(btn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STYLES (injected once)
  // ───────────────────────────────────────────────────────────────────────────

  private injectStyles(): void {
    if (document.getElementById(TabNavWidgetService.STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TabNavWidgetService.STYLE_ID;
    style.textContent = `
      .tr-button {
        background-color: var(--org-primary-color, ${TabNavWidgetService.FALLBACK_COLOR}) !important;
        border-color: var(--org-primary-color, ${TabNavWidgetService.FALLBACK_COLOR}) !important;
        z-index: 999 !important;
      }

      .tr-panel, .tr-container, .tr-overlay, .tr-white-border {
        z-index: 997 !important;
      }

      .tabnav-dismiss {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: none;
        background: #ef4444;
        color: #fff;
        font-size: 14px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,.3);
        padding: 0;
        opacity: 0;
        transition: opacity .2s ease;
        pointer-events: none;
        z-index: 1000;
      }
      .tr-button:hover ~ .tabnav-dismiss,
      .tabnav-dismiss:hover,
      .tabnav-dismiss:focus-visible {
        opacity: 1;
        pointer-events: auto;
      }
      @media (hover: none) {
        .tabnav-dismiss { opacity: 1; pointer-events: auto; }
      }

      .tabnav-restore {
        position: fixed;
        bottom: 16px;
        width: 32px;
        height: 32px;
        border: none;
        background: var(--org-primary-color, ${TabNavWidgetService.FALLBACK_COLOR});
        color: #fff;
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 4px;
        box-shadow: -2px 0 6px rgba(0,0,0,.2);
        z-index: 1000;
        transition: background .2s ease;
      }
      [dir="ltr"] .tabnav-restore, .tabnav-restore {
        right: 0; left: auto; border-radius: 8px 0 0 8px;
      }
      [dir="rtl"] .tabnav-restore {
        left: 0; right: auto; border-radius: 0 8px 8px 0;
      }
      .tabnav-restore:hover { filter: brightness(1.15); }
      .tabnav-restore svg   { width: 16px; height: 16px; }

      .tr-button[style*="display: none"] ~ .tr-container,
      .tr-button[style*="display: none"] ~ .tr-panel {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }

    if (this.isBrowser) {
      document.getElementById(TabNavWidgetService.SCRIPT_ID)?.remove();
      document.getElementById(TabNavWidgetService.NOSCRIPT_ID)?.remove();
      document.getElementById(TabNavWidgetService.DISMISS_BTN_ID)?.remove();
      document.getElementById(TabNavWidgetService.RESTORE_BTN_ID)?.remove();
      document.getElementById(TabNavWidgetService.STYLE_ID)?.remove();
    }
  }
}
