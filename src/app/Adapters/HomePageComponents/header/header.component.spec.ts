import { of, throwError } from 'rxjs';
import { HeaderComponent } from './header.component';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let authService: any;
  let router: any;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    authService = {
      logout: jasmine.createSpy('logout'),
      isLoggedIn$: of(true),
    };
    router = { navigate: jasmine.createSpy('navigate') };
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'errorFrom']);
    component = new HeaderComponent(
      { updateSystemDate: jasmine.createSpy('updateSystemDate') } as any,
      authService,
      router,
      {} as any,
      notify
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a message and navigates after logout', () => {
    authService.logout.and.returnValue(of(void 0));

    component.logout();

    expect(notify.success).toHaveBeenCalledWith('התנתקת בהצלחה.');
    expect(router.navigate).toHaveBeenCalledWith(['/Login']);
  });

  it('shows an error message when logout fails', () => {
    const err = new Error('logout failed');
    authService.logout.and.returnValue(throwError(() => err));

    component.logout();

    expect(notify.errorFrom).toHaveBeenCalledWith(err, 'ההתנתקות נכשלה. אנא נסו שוב.');
  });
});
