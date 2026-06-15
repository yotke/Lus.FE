import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../Infrastructure/Services/Auth/auth.service';
import { environment } from 'src/environments/environment';
import { NotificationService } from 'src/app/Infrastructure/Services/notification/notification.service';
import { TranslateService } from '@ngx-translate/core';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, AfterViewInit {
  @ViewChild('googleButton') googleButton?: ElementRef<HTMLDivElement>;

  loginForm: FormGroup;
  hidePassword = true;
  isSubmitting = false;
  errorMessage: string | null = null;
  googleEnabled = false;

  private googleInitialized = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
    private notify: NotificationService,
    private translate: TranslateService
  ) {
    this.loginForm = this.fb.group({
      email: [environment.production ? '' : environment.SignIn_Email, [Validators.required, Validators.email]],
      password: [environment.production ? '' : environment.SignIn_Password, [Validators.required]],
    });
  }

  ngOnInit(): void {
    const clientId = environment.googleClientId;
    // The Google client id only authorizes the live origins. On localhost the
    // GSI button returns 403 ("origin not allowed"), so hide it in local dev.
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    this.googleEnabled = !!clientId && !clientId.startsWith('REPLACE_WITH') && !isLocalhost;
  }

  ngAfterViewInit(): void {
    if (this.googleEnabled) {
      this.initializeGoogleSignIn();
    }
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  onSubmit(): void {
    this.errorMessage = null;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { email, password } = this.loginForm.value;

    this.authService.loginWithPassword(email, password).subscribe({
      next: response => {
        this.isSubmitting = false;
        const isSuccess = response?.isSuccess ?? response?.IsSuccess;
        if (isSuccess) {
          this.notify.success(this.translate.instant('auth.login.success'));
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/Home';
          this.router.navigateByUrl(returnUrl);
        } else {
          this.errorMessage = this.mapError(response);
          this.notify.error(this.errorMessage);
        }
      },
      error: () => {
        this.isSubmitting = false;
        const msg = this.translate.instant('auth.login.genericError') as string;
        this.errorMessage = msg;
        this.notify.error(msg);
      },
    });
  }

  private initializeGoogleSignIn(): void {
    if (this.googleInitialized || typeof google === 'undefined' || !google?.accounts?.id) {
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential: string }) => this.handleGoogleCredential(response),
    });

    if (this.googleButton?.nativeElement) {
      google.accounts.id.renderButton(this.googleButton.nativeElement, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
        locale: 'he',
      });
    }

    this.googleInitialized = true;
  }

  private handleGoogleCredential(response: { credential: string }): void {
    if (!response?.credential) {
      return;
    }

    // Google callbacks fire outside Angular's zone; re-enter so change detection runs.
    this.zone.run(() => {
      this.errorMessage = null;
      this.isSubmitting = true;

      this.authService.loginWithGoogle(response.credential).subscribe({
        next: result => {
          this.isSubmitting = false;
          const isSuccess = result?.isSuccess ?? result?.IsSuccess;
          if (isSuccess) {
            this.notify.success(this.translate.instant('auth.login.success'));
            const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/Home';
            this.router.navigateByUrl(returnUrl);
          } else {
            this.errorMessage = this.mapError(result);
            this.notify.error(this.errorMessage);
          }
        },
        error: () => {
          this.isSubmitting = false;
          const msg = this.translate.instant('auth.login.googleError') as string;
          this.errorMessage = msg;
          this.notify.error(msg);
        },
      });
    });
  }

  private mapError(response: any): string {
    const exceptionId = response?.exceptionId ?? response?.ExceptionId;
    const serverMessage = response?.errorMessage ?? response?.ErrorMessage;

    switch (exceptionId) {
      case 10:
        return this.translate.instant('auth.login.errors.userNotFound');
      case 11:
        return this.translate.instant('auth.login.errors.notConfirmed');
      case 12:
        return this.translate.instant('auth.login.errors.wrongCredentials');
      case 13:
        return serverMessage || this.translate.instant('auth.login.errors.passwordExpired');
      case 41:
        return this.translate.instant('auth.login.errors.captchaFailed');
      case 101: {
        const lockTime = response?.lockTimeLeft ?? response?.LockTimeLeft;
        return lockTime
          ? this.translate.instant('auth.login.errors.lockedWithTime', { minutes: Math.ceil(lockTime) })
          : this.translate.instant('auth.login.errors.locked');
      }
      default:
        return serverMessage || this.translate.instant('auth.login.errors.generic');
    }
  }
}
