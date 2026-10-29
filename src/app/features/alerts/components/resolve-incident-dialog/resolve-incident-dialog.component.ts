import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GPS_INCIDENT_TYPE } from '@core/constants/enums';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { AlertsApi } from '../../data-access/alerts.api';
import { AUTO_RESOLVING_TYPES, GpsIncidentDto } from '../../models/alerts.models';

/** Close a GPS incident by hand, with notes on what was done (`resolutionNotes`). */
@Component({
  selector: 'app-resolve-incident-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    EnumChipComponent,
    IconComponent,
  ],
  template: `
    <app-modal [open]="!!incident()" title="حل الحادثة" size="md" (closed)="closed.emit()">
      @if (incident(); as i) {
        <form [formGroup]="form" (ngSubmit)="submit(i)" novalidate>
          <div class="rid__head">
            <app-enum-chip [map]="TYPE" [value]="i.type" />
            <strong class="ltr">{{ i.plateNumber ?? '' }}</strong>
          </div>
          @if (autoResolves(i)) {
            <p class="rid__hint">
              <app-icon name="info" [size]="16" />
              هذا النوع يُغلق تلقائيًا عند عودة الإشارة أو رجوع الموتوسيكل للنطاق. أغلقه يدويًا فقط
              إذا تأكدت من معالجة السبب.
            </p>
          }
          <label class="form-label" for="rid-notes">ملاحظات الحل</label>
          <textarea
            id="rid-notes"
            class="form-control"
            rows="3"
            formControlName="resolutionNotes"
            placeholder="مثال: تم التواصل مع السائق وإعادة توصيل جهاز التتبع"
          ></textarea>
          <app-form-error [control]="form.controls.resolutionNotes" label="ملاحظات الحل" />
          <div class="modal-actions">
            <button type="button" class="btn" (click)="closed.emit()">إلغاء</button>
            <button type="submit" class="btn btn-brand" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
              }
              تأكيد الحل
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styles: `
    .rid__head {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 0.875rem;
      font-size: var(--fs-md);
    }
    .rid__hint {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      margin: 0 0 0.875rem;
      padding: 0.625rem 0.75rem;
      border-radius: var(--r);
      background: var(--bl-l);
      font-size: var(--fs-sm);
      app-icon {
        flex-shrink: 0;
        margin-top: 0.125rem;
        color: var(--bl);
      }
    }
  `,
})
export class ResolveIncidentDialogComponent {
  private readonly api = inject(AlertsApi);
  private readonly toast = inject(ToastService);

  /** The incident to resolve; `null` keeps the dialog closed. */
  readonly incident = input<GpsIncidentDto | null>(null);
  readonly closed = output<void>();
  readonly resolved = output<GpsIncidentDto>();

  protected readonly TYPE = GPS_INCIDENT_TYPE;
  protected readonly saving = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    resolutionNotes: ['', Validators.maxLength(1000)],
  });

  constructor() {
    effect(() => {
      if (this.incident()) untracked(() => this.form.reset());
    });
  }

  protected autoResolves(i: GpsIncidentDto): boolean {
    return AUTO_RESOLVING_TYPES.includes(i.type);
  }

  protected submit(i: GpsIncidentDto): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const notes = this.form.getRawValue().resolutionNotes.trim();
    this.saving.set(true);
    this.api.resolveIncident(i.id, { resolutionNotes: notes || null }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('تم حل الحادثة');
        this.resolved.emit(i);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
