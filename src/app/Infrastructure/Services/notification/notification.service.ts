import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

export type NotificationKind = 'success' | 'error' | 'info' | 'warning';

/**
 * App-wide user feedback. Wraps MatSnackBar with themed success/error/info/
 * warning toasts (panel classes are styled in basicStyle/ng-deep/
 * _base-form-components / _material-modern). Use this for every meaningful
 * action outcome — save, create, delete, and any caught error.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly defaults: MatSnackBarConfig = {
    horizontalPosition: 'center',
    verticalPosition: 'top',
    direction: 'rtl',
  };

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, duration = 3500): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 6000): void {
    this.show(message, 'error', duration);
  }

  info(message: string, duration = 3500): void {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration = 4500): void {
    this.show(message, 'warning', duration);
  }

  /** Map a caught HTTP/JS error to a friendly Hebrew message and show it. */
  errorFrom(err: unknown, fallback = 'אירעה שגיאה. אנא נסו שוב.'): void {
    this.error(this.resolveMessage(err, fallback));
  }

  private show(message: string, kind: NotificationKind, duration: number): void {
    if (!message) return;
    this.snackBar.open(message, 'סגור', {
      ...this.defaults,
      duration,
      panelClass: [`${kind}-snackbar`, 'app-snackbar'],
    });
  }

  private resolveMessage(err: any, fallback: string): string {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    // ASP.NET / API error shapes
    return (
      err?.error?.message ||
      err?.error?.Message ||
      err?.error?.title ||
      err?.message ||
      fallback
    );
  }
}
