import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let snackBar: jasmine.SpyObj<MatSnackBar>;
  let service: NotificationService;

  beforeEach(() => {
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    service = new NotificationService(snackBar);
  });

  it('shows success messages with the success panel class', () => {
    service.success('נשמר');

    expect(snackBar.open).toHaveBeenCalledWith(
      'נשמר',
      'סגור',
      jasmine.objectContaining({
        direction: 'rtl',
        panelClass: ['success-snackbar', 'app-snackbar'],
      })
    );
  });

  it('maps server errors to a friendly error message', () => {
    service.errorFrom({ error: { Message: 'שגיאת שרת' } });

    expect(snackBar.open).toHaveBeenCalledWith(
      'שגיאת שרת',
      'סגור',
      jasmine.objectContaining({
        panelClass: ['error-snackbar', 'app-snackbar'],
      })
    );
  });

  it('uses fallback text when the error has no message', () => {
    service.errorFrom({}, 'נכשל');

    expect(snackBar.open).toHaveBeenCalledWith(
      'נכשל',
      'סגור',
      jasmine.objectContaining({
        panelClass: ['error-snackbar', 'app-snackbar'],
      })
    );
  });
});
