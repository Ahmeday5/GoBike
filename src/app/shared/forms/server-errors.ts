import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';

/**
 * Applies a failed submit to a form, per the API contract:
 *   - 400 → `errors` is keyed by camelCase field name: each message goes under
 *     its control (rendered by `<app-form-error>` via the `server` error key)
 *   - anything else (409/422/…) → the API's Arabic `message` as a toast
 *
 * Returns true when at least one message was attached to a field.
 *
 *   error: (err: ApiError) => applyServerErrors(this.form, err, this.toast)
 *
 * Pair the request with `withSilentErrors()` so the error interceptor doesn't
 * toast the same failure twice.
 */
export function applyServerErrors(form: FormGroup, err: ApiError, toast?: ToastService): boolean {
  let attached = false;
  for (const [field, messages] of Object.entries(err.fieldErrors ?? {})) {
    const control = findControl(form, field);
    const message = Array.isArray(messages) ? messages[0] : messages;
    if (control && message) {
      control.setErrors({ ...control.errors, server: message });
      control.markAsTouched();
      attached = true;
    }
  }
  if (!attached) toast?.error(err.message);
  return attached;
}

/** Matches `fieldName`, `FieldName` and dotted/indexed paths like `faults[0].description`. */
function findControl(form: FormGroup, field: string): AbstractControl | null {
  const path = field.replace(/\[(\d+)\]/g, '.$1');
  const camel = path
    .split('.')
    .map((p) => p.charAt(0).toLowerCase() + p.slice(1))
    .join('.');
  return form.get(camel) ?? form.get(path);
}
