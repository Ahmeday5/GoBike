import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ConfirmDialogConfig, DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from '@core/models/api-response.model';
import { ModalComponent } from '../modal/modal.component';
import { FormErrorComponent } from '../form-error/form-error.component';

export type ReasonDialogTone = 'danger' | 'warning' | 'brand';

/**
 * One free-text field + a submit button — the shape of every "void / cancel /
 * reject / resolve, and say why" action. The dialog owns the busy state and
 * the error display; the parent only supplies the request:
 *
 *   <app-reason-dialog [open]="!!voiding()" title="إلغاء الدفعة" label="سبب الإلغاء"
 *     [message]="'سيُلغى سداد ' + (voiding()?.amount | money)"
 *     [action]="voidAction" [confirm]="voidConfirm()"
 *     (closed)="voiding.set(null)" (done)="onVoided()" />
 *
 *   protected readonly voidAction = (reason: string) => this.api.voidPayment(id, { reason });
 *
 * `confirm` (optional) asks a second time before sending — use it for
 * financial or irreversible actions so the effect is spelled out.
 */
@Component({
  selector: 'app-reason-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent],
  template: `
    <app-modal
      [open]="open()"
      [title]="title()"
      [titleColorClass]="tone() === 'danger' ? 'text-danger' : ''"
      size="sm"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (message()) {
          <p class="rd-text">{{ message() }}</p>
        }
        <label class="form-label" for="rd-reason">{{ label() }}{{ required() ? ' *' : '' }}</label>
        <textarea
          id="rd-reason"
          class="form-control"
          rows="3"
          formControlName="reason"
          [placeholder]="placeholder()"
        ></textarea>
        <app-form-error [control]="form.controls.reason" [label]="label()" />

        <div class="modal-actions">
          <button type="button" class="btn" (click)="closed.emit()">رجوع</button>
          <button type="submit" [class]="buttonClass()" [disabled]="saving()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            }
            {{ confirmText() }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: `
    .rd-text {
      margin: 0 0 0.75rem;
      font-size: var(--fs-sm);
      line-height: 1.8;
      color: var(--txt2);
      white-space: pre-line;
    }
  `,
})
export class ReasonDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly label = input('السبب');
  readonly message = input('');
  readonly placeholder = input('');
  readonly confirmText = input('تأكيد');
  readonly tone = input<ReasonDialogTone>('danger');
  readonly required = input(true);
  readonly maxLength = input(500);
  /** Sends the request. The dialog shows the spinner and the API error. */
  readonly action = input.required<(reason: string) => Observable<unknown>>();
  /** Optional second confirmation stating the effect (financial/irreversible actions). */
  readonly confirm = input<ConfirmDialogConfig | null>(null);
  /** Toast shown on success (empty → none). */
  readonly successMessage = input('');

  readonly closed = output<void>();
  readonly done = output<string>();

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({ reason: [''] });

  protected readonly buttonClass = computed(() => {
    const tone = this.tone();
    return tone === 'danger' ? 'btn btn-re' : tone === 'warning' ? 'btn btn-am' : 'btn btn-brand';
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const required = this.required();
      const max = this.maxLength();
      untracked(() => {
        if (!isOpen) return;
        const control = this.form.controls.reason;
        control.setValidators([
          ...(required ? [Validators.required] : []),
          Validators.maxLength(max),
        ]);
        this.form.reset();
        this.saving.set(false);
      });
    });
  }

  protected async submit(): Promise<void> {
    const control = this.form.controls.reason;
    control.setValue(control.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const confirm = this.confirm();
    if (confirm && !(await this.dialog.confirm(confirm))) return;

    const reason = control.value;
    this.saving.set(true);
    this.action()(reason).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.successMessage()) this.toast.success(this.successMessage());
        this.done.emit(reason);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        const field = err.fieldErrors && Object.values(err.fieldErrors)[0];
        const message = Array.isArray(field) ? field[0] : field;
        if (err.status === 400 && message) {
          control.setErrors({ server: message });
          control.markAsTouched();
        } else {
          this.toast.error(err.message);
        }
      },
    });
  }
}
