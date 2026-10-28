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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LookupService } from '@core/data/lookup.service';
import { MotorcycleDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { SaveMotorcycleRequest } from '../../models/motorcycle.models';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Create / edit a motorcycle. Pass `motorcycle` to edit (its `rowVersion` is
 * sent back; a 409 means someone else saved first → we tell the user and
 * emit `conflict` so the page reloads fresh data).
 */
@Component({
  selector: 'app-motorcycle-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, FormErrorComponent],
  templateUrl: './motorcycle-form-dialog.component.html',
})
export class MotorcycleFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MotorcyclesApi);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);

  readonly open = input.required<boolean>();
  readonly motorcycle = input<MotorcycleDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<MotorcycleDto>();
  readonly conflict = output<void>();

  protected readonly offices = toSignal(this.lookups.offices(), { initialValue: [] });
  protected readonly staff = toSignal(this.lookups.staff(), { initialValue: [] });
  protected readonly policies = toSignal(this.api.policies(), { initialValue: [] });
  protected readonly saving = signal(false);
  protected readonly maxYear = CURRENT_YEAR + 1;

  protected readonly form = this.fb.nonNullable.group({
    plateNumber: ['', [Validators.required, Validators.maxLength(20)]],
    internalCode: [''],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    manufacturingYear: [
      null as number | null,
      [Validators.min(1990), Validators.max(CURRENT_YEAR + 1)],
    ],
    color: [''],
    chassisNumber: [''],
    engineNumber: [''],
    purchaseDate: [''],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    preparationCost: [0, [Validators.required, Validators.min(0)]],
    equipmentCost: [0, [Validators.required, Validators.min(0)]],
    officeId: ['', Validators.required],
    supervisorUserId: [''],
    maintenancePolicyId: [''],
    notes: [''],
  });

  constructor() {
    // (Re)fill the form every time the dialog opens.
    effect(() => {
      if (!this.open()) return;
      const m = this.motorcycle();
      untracked(() => {
        this.form.reset();
        if (m) {
          this.form.patchValue({
            plateNumber: m.plateNumber,
            internalCode: m.internalCode ?? '',
            brand: m.brand,
            model: m.model,
            manufacturingYear: m.manufacturingYear ?? null,
            color: m.color ?? '',
            chassisNumber: m.chassisNumber ?? '',
            engineNumber: m.engineNumber ?? '',
            purchaseDate: m.purchaseDate ?? '',
            purchasePrice: m.purchasePrice ?? 0,
            preparationCost: m.preparationCost ?? 0,
            equipmentCost: m.equipmentCost ?? 0,
            officeId: m.officeId,
            supervisorUserId: m.supervisorUserId ?? '',
            maintenancePolicyId: m.maintenancePolicyId ?? '',
            notes: m.notes ?? '',
          });
        }
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SaveMotorcycleRequest = {
      ...v,
      internalCode: v.internalCode || null,
      color: v.color || null,
      chassisNumber: v.chassisNumber || null,
      engineNumber: v.engineNumber || null,
      purchaseDate: v.purchaseDate || null,
      supervisorUserId: v.supervisorUserId || null,
      maintenancePolicyId: v.maintenancePolicyId || null,
      notes: v.notes || null,
      rowVersion: this.motorcycle()?.rowVersion ?? null,
    };

    const editing = this.motorcycle();
    this.saving.set(true);
    const request$ = editing ? this.api.update(editing.id, body) : this.api.create(body);
    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(editing ? 'تم حفظ التعديلات' : 'تمت إضافة الموتوسيكل');
        this.saved.emit(saved);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        if (editing && err.status === 409) {
          this.toast.warning(
            'قام مستخدم آخر بتعديل هذا الموتوسيكل. تم تحميل أحدث بيانات، راجعها ثم أعد المحاولة.',
          );
          this.conflict.emit();
          return;
        }
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
