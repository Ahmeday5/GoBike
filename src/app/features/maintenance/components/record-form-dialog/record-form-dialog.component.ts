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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { LookupService } from '@core/data/lookup.service';
import { ApiError } from '@core/models/api-response.model';
import { MaintenanceRecordDto, MotorcycleDto } from '@core/models/domain.models';
import { MAINTENANCE_TYPE, MaintenanceType, enumOptions } from '@core/constants/enums';
import { ToastService } from '@core/services/toast.service';
import { cairoInputToUtc, utcToCairoInput } from '@core/utils/cairo-time.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import {
  PickerOption,
  RemotePickerComponent,
} from '@shared/components/remote-picker/remote-picker.component';
import { MaintenanceApi } from '../../data-access/maintenance.api';
import { SaveMaintenanceRecordRequest, moneyOrNull } from '../../models/maintenance.models';

/**
 * Create (`POST /maintenance/records`) or edit (`PUT /maintenance/records/{id}`)
 * a general maintenance record. Repairs opened by a return inspection are
 * edited through the technician report instead.
 */
@Component({
  selector: 'app-record-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    RemotePickerComponent,
    MoneyPipe,
  ],
  templateUrl: './record-form-dialog.component.html',
})
export class RecordFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MaintenanceApi);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  /** Record to edit; null → create. */
  readonly record = input<MaintenanceRecordDto | null>(null);
  /** Motorcycle to preselect when creating (e.g. the page is filtered by one). */
  readonly presetMotorcycle = input<PickerOption | null>(null);

  readonly closed = output<void>();
  readonly saved = output<MaintenanceRecordDto>();

  protected readonly typeOptions = enumOptions(MAINTENANCE_TYPE);
  protected readonly saving = signal(false);
  protected readonly isEdit = computed(() => !!this.record());
  protected readonly motorcycleOption = signal<PickerOption | null>(null);

  protected readonly searchMotorcycles = (term: string) =>
    this.lookups.motorcycles(term).pipe(
      map((rows) =>
        rows.map((m): PickerOption<MotorcycleDto> => ({
          value: m.id,
          label: m.plateNumber,
          hint: [m.brand, m.model, m.officeName].filter(Boolean).join(' · '),
          data: m,
        })),
      ),
    );

  protected readonly form = this.fb.nonNullable.group({
    motorcycleId: ['', Validators.required],
    type: ['Periodic' as MaintenanceType, Validators.required],
    scheduledAt: [''],
    issueDescription: ['', Validators.maxLength(2000)],
    workPerformed: ['', Validators.maxLength(2000)],
    workshop: ['', Validators.maxLength(200)],
    technician: ['', Validators.maxLength(200)],
    laborCost: [null as number | null, Validators.min(0)],
    otherCost: [null as number | null, Validators.min(0)],
    notes: ['', Validators.maxLength(2000)],
    resetsMaintenanceCycle: [false],
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly isPeriodic = computed(() => this.values().type === 'Periodic');
  protected readonly costTotal = computed(() => {
    const v = this.values();
    return (moneyOrNull(v.laborCost) ?? 0) + (moneyOrNull(v.otherCost) ?? 0);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const r = this.record();
      const preset = this.presetMotorcycle();
      untracked(() => {
        this.saving.set(false);
        this.form.reset({
          motorcycleId: r?.motorcycleId ?? preset?.value ?? '',
          type: r?.type ?? 'Periodic',
          scheduledAt: utcToCairoInput(r?.scheduledAtUtc),
          issueDescription: r?.issueDescription ?? '',
          workPerformed: r?.workPerformed ?? '',
          workshop: r?.workshop ?? '',
          technician: r?.technician ?? '',
          laborCost: r?.laborCost ?? null,
          otherCost: r?.otherCost ?? null,
          notes: r?.notes ?? '',
          resetsMaintenanceCycle: !!r?.resetsMaintenanceCycle,
        });
        this.motorcycleOption.set(
          r ? { value: r.motorcycleId, label: r.plateNumber ?? '…' } : preset,
        );
        // The bike of an existing record can't change.
        if (r) this.form.controls.motorcycleId.disable();
        else this.form.controls.motorcycleId.enable();
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const r = this.record();
    const text = (s: string) => s.trim() || null;
    const body: SaveMaintenanceRecordRequest = {
      motorcycleId: v.motorcycleId,
      type: v.type,
      scheduledAtUtc: cairoInputToUtc(v.scheduledAt),
      issueDescription: text(v.issueDescription),
      workPerformed: text(v.workPerformed),
      workshop: text(v.workshop),
      technician: text(v.technician),
      laborCost: moneyOrNull(v.laborCost),
      otherCost: moneyOrNull(v.otherCost),
      notes: text(v.notes),
      resetsMaintenanceCycle: v.type === 'Periodic' ? v.resetsMaintenanceCycle : false,
      ...(r?.rowVersion ? { rowVersion: r.rowVersion } : {}),
    };

    this.saving.set(true);
    const request = r ? this.api.update(r.id, body) : this.api.create(body);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(r ? 'تم حفظ التعديلات' : 'تم إنشاء سجل الصيانة');
        // Some endpoints return an empty body — fall back to what we know.
        this.saved.emit(
          saved?.id ? saved : ({ ...r, ...body, id: r?.id ?? '' } as MaintenanceRecordDto),
        );
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.toast.error('عدّل مستخدم آخر هذا السجل للتو. أغلق النافذة وأعد تحميل الصفحة.');
          return;
        }
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
