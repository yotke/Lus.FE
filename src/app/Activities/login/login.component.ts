import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../Infrastructure/Services/Auth/auth.service';
import { environment } from 'src/environments/environment';

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
    private zone: NgZone
  ) {
    this.loginForm = this.fb.group({
      email: [environment.production ? '' : environment.SignIn_Email, [Validators.required, Validators.email]],
      password: [environment.production ? '' : environment.SignIn_Password, [Validators.required]],
    });
  }

  ngOnInit(): void {
    const clientId = environment.googleClientId;
    this.googleEnabled = !!clientId && !clientId.startsWith('REPLACE_WITH');
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
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/Home';
          this.router.navigateByUrl(returnUrl);
        } else {
          this.errorMessage = this.mapError(response);
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'אירעה שגיאה בהתחברות. נסו שוב מאוחר יותר.';
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
            const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/Home';
            this.router.navigateByUrl(returnUrl);
          } else {
            this.errorMessage = this.mapError(result);
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.errorMessage = 'ההתחברות עם Google נכשלה. נסו שוב.';
        },
      });
    });
  }

  private mapError(response: any): string {
    const exceptionId = response?.exceptionId ?? response?.ExceptionId;
    const serverMessage = response?.errorMessage ?? response?.ErrorMessage;

    switch (exceptionId) {
      case 10:
        return 'משתמש לא נמצא.';
      case 11:
        return 'המשתמש טרם אומת.';
      case 12:
        return 'שם משתמש או סיסמה שגויים.';
      case 13:
        return serverMessage || 'תוקף הסיסמה פג. יש לאפס סיסמה.';
      case 41:
        return 'אימות אבטחה נכשל. נסו שוב.';
      case 101: {
        const lockTime = response?.lockTimeLeft ?? response?.LockTimeLeft;
        return lockTime
          ? `החשבון ננעל. נסו שוב בעוד ${Math.ceil(lockTime)} דקות.`
          : 'החשבון ננעל זמנית עקב ניסיונות התחברות מרובים.';
      }
      default:
        return serverMessage || 'ההתחברות נכשלה. בדקו את הפרטים ונסו שוב.';
    }
  }
}
