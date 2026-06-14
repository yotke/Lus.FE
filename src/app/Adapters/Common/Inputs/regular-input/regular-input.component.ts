import {
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Modern regular input — ported visual design from the Weekeye/ArmyLuz system,
 * down-levelled to Lus (no ngx-translate / LanguageService dependency).
 *
 * Renders the `.modern-input-wrapper` structure the basicStyle deep-styles
 * target (floating label, prefix/suffix svg icons, animated border, error +
 * char-count footer). The original Lus API (title/placeholder/formGroup/
 * formControlName/selectedValue/showLabel/inputType/inputClass/inputStyle +
 * selectedValueChange/OnChange) is preserved so existing call sites keep working.
 */
@Component({
  selector: 'app-regular-input',
  templateUrl: './regular-input.component.html',
  styleUrls: ['./regular-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RegularInputComponent),
      multi: true
    }
  ]
})
export class RegularInputComponent implements ControlValueAccessor {
  // ── Existing API (kept for backwards compatibility) ─────────────────────────
  @Input() placeholder: string = '';
  @Input() formGroup: FormGroup | null = null;
  @Input() formControlName: string | null = null;
  @Input() selectedValue: any | null = null;
  @Input() title: string | null = null;
  @Input() showLabel: boolean = false;
  @Input() inputType: string = 'text';
  @Input() inputClass: string | null = null;
  @Input() inputStyle: { [key: string]: string } | null = null;

  // ── New modern options ───────────────────────────────────────────────────
  @Input() prefixIcon: string = '';
  @Input() suffixIcon: string = '';
  @Input() prefixIconClass: string | string[] | { [klass: string]: any } = '';
  @Input() suffixIconClass: string | string[] | { [klass: string]: any } = '';
  @Input() showSearchIcon: boolean = false;
  @Input() showCharacterCount: boolean = false;
  @Input() helpText: string = '';
  @Input() readonly: boolean = false;
  @Input() maxLength: number | null = null;
  @Input() minLength: number | null = null;
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() step: number | null = null;
  @Input() autocomplete: string = 'off';
  @Input() disabled: boolean = false;
  @Input() dir: 'rtl' | 'ltr' = 'rtl';
  /** Optional map of validator-error key → message text. */
  @Input() errorMessages: { [key: string]: string } = {};

  @Output() selectedValueChange = new EventEmitter<any>();
  @Output('OnChange') OnValueChangeCallback = new EventEmitter<any>();
  @Output() inputFocused = new EventEmitter<void>();
  @Output() inputBlurred = new EventEmitter<void>();
  @Output() inputChanged = new EventEmitter<string>();
  @Output() searchClicked = new EventEmitter<void>();
  @Output() suffixIconClicked = new EventEmitter<void>();

  isFocused = false;
  isHovered = false;

  private onChange: any = () => { };
  private onTouched: any = () => { };

  constructor(private cdr: ChangeDetectorRef) { }

  // ── ControlValueAccessor ─────────────────────────────────────────────────
  writeValue(value: any): void {
    this.selectedValue = value;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  get control(): FormControl | null {
    if (this.formControlName && this.formGroup) {
      return this.formGroup.get(this.formControlName) as FormControl;
    }
    return null;
  }

  // ── Display helpers ──────────────────────────────────────────────────────
  get titleText(): string { return this.title ?? ''; }

  get shouldFloatLabel(): boolean { return this.isFocused || this.hasValue; }

  get hasValue(): boolean {
    const val = this.control ? this.control.value : this.selectedValue;
    return val !== null && val !== undefined && val !== '';
  }

  get hasError(): boolean {
    return !!(this.control?.invalid && (this.control?.dirty || this.control?.touched));
  }

  get errorText(): string {
    const errors = this.control?.errors;
    if (!errors) return '';
    for (const key of Object.keys(errors)) {
      if (this.errorMessages[key]) return this.errorMessages[key];
    }
    if (errors['required']) return 'שדה חובה';
    if (errors['email']) return 'כתובת אימייל לא תקינה';
    if (errors['pattern']) return 'פורמט לא תקין';
    if (errors['min']) return `ערך מינימלי: ${errors['min'].min}`;
    if (errors['max']) return `ערך מקסימלי: ${errors['max'].max}`;
    if (errors['minlength']) return `אורך מינימלי: ${errors['minlength'].requiredLength}`;
    if (errors['maxlength']) return `אורך מקסימלי: ${errors['maxlength'].requiredLength}`;
    return 'ערך לא תקין';
  }

  getCharacterCount(): number {
    return this.selectedValue ? this.selectedValue.toString().length : 0;
  }

  // ── Events ──────────────────────────────────────────────────────────────
  emitSelectedValueChange(value: any): void {
    this.selectedValue = value;
    this.onChange(value);
    this.selectedValueChange.emit(value);
    this.OnValueChangeCallback.emit(value);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.emitSelectedValueChange(value);
    this.inputChanged.emit(value);
  }

  onFocus(): void { this.isFocused = true; this.cdr.markForCheck(); this.inputFocused.emit(); }
  onBlur(): void { this.isFocused = false; this.onTouched(); this.cdr.markForCheck(); this.inputBlurred.emit(); }
  onMouseEnter(): void { this.isHovered = true; this.cdr.markForCheck(); }
  onMouseLeave(): void { this.isHovered = false; this.cdr.markForCheck(); }
  onSearchClicked(): void { this.searchClicked.emit(); }
  onSuffixIconClick(): void { this.suffixIconClicked.emit(); }
}
