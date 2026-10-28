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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from '@core/models/api-response.model';
import { InspectionDto, RentalDto } from '@core/models/domain.models';
import { APP_ROUTES } from '@core/constants/app-routes';
import { InspectionResult } from '@core/constants/enums';
import { cairoInputToUtc, cairoNowInput } from '@core/utils/cairo-time.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  FaultFormGroup,
  FaultsEditorComponent,
  createFaultGroup,
  faultsPayload,
} from '@shared/components/faults-editor/faults-editor.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { RentalsApi } from '../../data-access/rentals.api';
import { ReturnMotorcycleRequest } from '../../models/rental.models';
import { inspectionLink } from '../../rentals.links';

/**
 * Return a rented motorcycle (inspections.manage) via `POST /rentals/{id}/return`:
 * ends the rental and records the inspection in one call. Ok → bike green and
 * available; HasFaults → bike red and a repair record joins the technician queue.
 */
@Component({
  selector: 'app-return-rental-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ModalComponent,
    FormErrorComponent,
    IconComponent,
    FaultsEditorComponent,
  ],
  templateUrl: './return-rental-dialog.component.html',
  styleUrl: './return-rental-dialog.component.scss',
})
export class ReturnRentalDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RentalsApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly rental = input.required<RentalDto | null>();
  readonly closed = output<void>();
  readonly returned = output<InspectionDto>();

  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly outcome = signal<InspectionDto | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    returnedAt: ['', Validators.required],
    result: ['' as InspectionResult | '', Validators.required],
    faultSummary: ['', Validators.maxLength(1000)],
    faults: new FormArray<FaultFormGroup>([]),
    notes: [''],
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly result = computed(() => this.values().result);
  /** "At least one fault OR a summary" — only enforced for HasFaults. */
  protected readonly faultsMissing = computed(() => {
    const v = this.values();
    return v.result === 'HasFaults' && v.faults.length === 0 && !v.faultSummary.trim();
  });

  protected readonly repairLink = computed(() => {
    const id = this.outcome()?.maintenanceRecordId;
    return id ? APP_ROUTES.maintenanceRecord(id) : null;
  });
  protected readonly inspectionLink = computed(() => {
    const id = this.outcome()?.id;
    return id ? inspectionLink(id) : null;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.controls.faults.clear();
        this.form.reset({ returnedAt: cairoNowInput() });
        this.submitted.set(false);
        this.outcome.set(null);
      });
    });
  }

  protected setResult(result: InspectionResult): void {
    this.form.controls.result.setValue(result);
    // Start the fault list with one row so the user can type right away.
    if (result === 'HasFaults' && this.form.controls.faults.length === 0) {
      this.form.controls.faults.push(createFaultGroup());
    }
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    const c = this.form.controls;
    const hasFaults = c.result.value === 'HasFaults';
    const invalid =
      c.returnedAt.invalid ||
      c.result.invalid ||
      c.faultSummary.invalid ||
      (hasFaults && (c.faults.invalid || this.faultsMissing()));
    if (invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const r = this.rental();
    if (!r) return;
    const faults = hasFaults ? faultsPayload(c.faults) : [];
    const plate = r.plateNumber ?? '';
    const ok = await this.dialog.confirm(
      hasFaults
        ? {
            title: 'تأكيد الاستلام بأعطال',
            message:
              `سيتم إنهاء إيجار ${plate} مع ${r.driverName ?? 'السائق'} وتسجيل ` +
              `${faults.length ? `${faults.length} عطل` : 'الأعطال الموصوفة'}. ` +
              'ستتحول الموتوسيكل إلى الحالة الحمراء ويُفتح سجل إصلاح في طابور الفني، ' +
              'ولن تعود متاحة إلا بعد اعتماد المشرف للإصلاح.',
            type: 'warning',
            confirmText: 'تسجيل الاستلام بأعطال',
          }
        : {
            title: 'تأكيد الاستلام سليمة',
            message:
              `سيتم إنهاء إيجار ${plate} مع ${r.driverName ?? 'السائق'} وتسجيلها سليمة. ` +
              'ستصبح الموتوسيكل خضراء ومتاحة للتأجير فورًا.',
            type: 'info',
            confirmText: 'تسجيل الاستلام',
          },
    );
    if (!ok) return;

    const v = this.form.getRawValue();
    const body: ReturnMotorcycleRequest = {
      returnedAtUtc: cairoInputToUtc(v.returnedAt),
      result: v.result as InspectionResult,
      faultSummary: hasFaults ? v.faultSummary.trim() || null : null,
      faults,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api.returnMotorcycle(r.id, body).subscribe({
      next: (inspection) => {
        this.saving.set(false);
        // Some backends return an empty body — fall back to what was sent.
        const outcome: InspectionDto = {
          ...inspection,
          result: inspection?.result ?? body.result,
          motorcycleId: inspection?.motorcycleId ?? r.motorcycleId,
          plateNumber: inspection?.plateNumber ?? r.plateNumber,
        } as InspectionDto;
        this.outcome.set(outcome);
        this.toast.success('تم تسجيل استلام الموتوسيكل');
        this.returned.emit(outcome);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
