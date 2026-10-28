import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Maps a control's first failing validator into a human-readable message.
 *
 * Use via `<app-form-error [control]="form.controls.email" label="Email" />`
 * or directly: `firstError(ctrl, 'Field')`.
 *
 * Order matters — `required` is checked first so an empty field never gets
 * a "wrong format" message.
 */
export function firstError(
  control: AbstractControl | null | undefined,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control) return null;
  if (!(control.dirty || control.touched)) return null;
  if (!control.errors) return null;

  return resolveMessage(control.errors, label, custom);
}

/** Same as `firstError` but ignores touched/dirty — useful for forced display. */
export function firstErrorAlways(
  control: AbstractControl | null | undefined,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control?.errors) return null;
  return resolveMessage(control.errors, label, custom);
}

function resolveMessage(
  errors: ValidationErrors,
  label: string,
  custom?: Record<string, (e: unknown) => string>,
): string {
  // Custom keys always win.
  if (custom) {
    for (const key of Object.keys(custom)) {
      if (errors[key] !== undefined) return custom[key](errors[key]);
    }
  }

  if (errors['required'] !== undefined) {
    return `${label} مطلوب`;
  }
  if (errors['email'] !== undefined) {
    return `صيغة ${label} غير صحيحة`;
  }
  if (errors['minlength']) {
    const req = errors['minlength'].requiredLength;
    return `${label} يجب ألا يقل عن ${req} أحرف`;
  }
  if (errors['maxlength']) {
    const req = errors['maxlength'].requiredLength;
    return `${label} يجب ألا يزيد عن ${req} حرفًا`;
  }
  if (errors['min'] !== undefined) {
    return `${label} يجب أن يكون ${errors['min'].min} أو أكثر`;
  }
  if (errors['max'] !== undefined) {
    return `${label} يجب أن يكون ${errors['max'].max} أو أقل`;
  }
  if (errors['phone'] !== undefined) {
    return `${label} غير صحيح`;
  }
  if (errors['pattern'] !== undefined) {
    return `${label} غير صالح`;
  }

  // Unknown validator — show the raw key as a graceful fallback.
  const firstKey = Object.keys(errors)[0];
  const value = errors[firstKey];
  if (typeof value === 'string') return value;
  return `${label} غير صالح`;
}

// ─────────────────────── reusable validators ───────────────────────

/** Basic phone number validator — digits, spaces, `+`, `-`, `()`, 7–15 digits total. */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    const pattern = /^[\d+\-()\s]+$/;
    return pattern.test(value) && digits.length >= 7 && digits.length <= 15
      ? null
      : { phone: true };
  };
}
