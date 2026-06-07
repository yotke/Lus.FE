import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../Infrastructure/Services/Auth/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isSubmitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        idNumber: [''],
        // Matches the backend PasswordConfigOptions: min 6 chars, upper, lower,
        // digit and a special character.
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
        acceptTerms: [false, [Validators.requiredTrue]],
      },
      { validators: RegisterComponent.passwordsMatch }
    );
  }

  private static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
  }

  get firstName() {
    return this.registerForm.get('firstName');
  }
  get lastName() {
    return this.registerForm.get('lastName');
  }
  get email() {
    return this.registerForm.get('email');
  }
  get password() {
    return this.registerForm.get('password');
  }
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }
  get acceptTerms() {
    return this.registerForm.get('acceptTerms');
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const value = this.registerForm.value;

    this.authService
      .register({
        email: value.email,
        password: value.password,
        confirmPassword: value.confirmPassword,
        firstName: value.firstName,
        lastName: value.lastName,
        phone: value.phone,
        idNumber: value.idNumber,
      })
      .subscribe({
        next: response => {
          this.isSubmitting = false;
          const isSuccess = response?.isSuccess ?? response?.IsSuccess;
          if (isSuccess) {
            this.successMessage =
              'נרשמת בהצלחה! שלחנו אליך דוא"ל לאימות החשבון. יש לאמת לפני ההתחברות.';
            this.registerForm.disable();
            setTimeout(() => this.router.navigateByUrl('/Login'), 4000);
          } else {
            this.errorMessage = this.mapError(response);
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.errorMessage = 'אירעה שגיאה בהרשמה. נסו שוב מאוחר יותר.';
        },
      });
  }

  goToLogin(): void {
    this.router.navigateByUrl('/Login');
  }

  private mapError(response: any): string {
    const exceptionId = response?.exceptionId ?? response?.ExceptionId;
    const serverMessage = response?.errorMessage ?? response?.ErrorMessage;

    switch (exceptionId) {
      case 10:
        return 'הפרטים שהוזנו אינם תקינים.';
      case 17:
        return 'כתובת הדוא"ל כבר רשומה במערכת.';
      case 41:
        return 'אימות אבטחה נכשל. נסו שוב.';
      default:
        return serverMessage || 'ההרשמה נכשלה. בדקו את הפרטים ונסו שוב.';
    }
  }
}
