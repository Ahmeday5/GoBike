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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { startWith } from 'rxjs';
import { MAINTENANCE_ALERT_LEVEL } from '@core/constants/enums';
import { ApiError } from '@core/models/api-response.model';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { PoliciesApi } from '../../data-access/policies.api';
import {
  MaintenancePolicyDto,
  POLICY_DEFAULTS,
  SaveMaintenancePolicyRequest,
  parseRecipients,
  serializeRecipients,
} from '../../models/policy.models';
import { ThresholdBarComponent } from '../threshold-bar/threshold-bar.component';
import { RecipientsPickerComponent } from '../recipients-picker/recipients-picker.component';

type RecipientControl =
  | 'firstWarningRecipients'
  | 'secondWarningRecipients'
  | 'criticalRecipients'
  | 'overdueRecipients';

/** Fine example shown under the price field ("going 50 km over costs …"). */
const EXAMPLE_OVER_KM = 50;

/** Thresholds must strictly increase: first < second < critical < max. */
function ascendingThresholds(group: AbstractControl): ValidationErrors | null {
  const v = group.value as Record<string, number | null>;
  const list = [v['firstWarningKm'], v['secondWarningKm'], v['criticalKm'], v['maxKm']];
  if (list.some((n) => n == null || Number.isNaN(n))) return null;
  const ok = list.every((n, i) => i === 0 || (n as number) > (list[i - 1] as number));
  return ok ? null : { thresholdOrder: true };
}

/**
 * Create / edit an oil-change policy: thresholds with a live scale preview,
 * the per-km overdue fine and who is notified at each level. Exactly one
 * policy is the default — turning it on here demotes the current one.
 */
@Component({
  selector: 'app-policy-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    EnumChipComponent,
    IconComponent,
    ThresholdBarComponent,
    RecipientsPickerComponent,
  ],
  templateUrl: './policy-form-dialog.component.html',
  styleUrl: './policy-form-dialog.component.scss',
})
export class PolicyFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PoliciesApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly policy = input<MaintenancePolicyDto | null>(null);
  /** The policy that is the default right now (to explain the replacement). */
  readonly currentDefault = input<MaintenancePolicyDto | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly LEVEL = MAINTENANCE_ALERT_LEVEL;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: [''],
      isDefault: [false],
      isActive: [true],
      firstWarningKm: [
        POLICY_DEFAULTS.firstWarningKm as number,
        [Validators.required, Validators.min(1)],
      ],
      secondWarningKm: [
        POLICY_DEFAULTS.secondWarningKm as number,
        [Validators.required, Validators.min(1)],
      ],
      criticalKm: [POLICY_DEFAULTS.criticalKm as number, [Validators.required, Validators.min(1)]],
      maxKm: [POLICY_DEFAULTS.maxKm as number, [Validators.required, Validators.min(1)]],
      overdueFinePerKm: [0, [Validators.required, Validators.min(0)]],
      firstWarningRecipients: [[] as string[]],
      secondWarningRecipients: [[] as string[]],
      criticalRecipients: [[] as string[]],
      overdueRecipients: [[] as string[]],
      criticalReminderIntervalHours: [24, [Validators.required, Validators.min(1)]],
      notifyOnlyHighestWhenSkipping: [true],
    },
    { validators: ascendingThresholds },
  );

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly fineExample = computed(() => {
    const price = Number(this.value().overdueFinePerKm) || 0;
    return formatMoney(price * EXAMPLE_OVER_KM);
  });
  protected readonly exampleKm = EXAMPLE_OVER_KM;

  /** Rows of the recipients section (level → its control). */
  protected readonly recipientRows = [
    { level: 'FirstWarning', control: 'firstWarningRecipients' },
    { level: 'SecondWarning', control: 'secondWarningRecipients' },
    { level: 'Critical', control: 'criticalRecipients' },
    { level: 'Overdue', control: 'overdueRecipients' },
  ] as const;

  protected readonly isEditingDefault = computed(() => !!this.policy()?.isDefault);

  /** Shown when this save will take the default flag away from another policy. */
  protected readonly replacesDefault = computed(() => {
    const current = this.currentDefault();
    return (
      !!this.value().isDefault && !!current && !this.isEditingDefault() && current.id !== this.policy()?.id
    );
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const p = this.policy();
      untracked(() => this.fill(p));
    });
  }

  private fill(p: MaintenancePolicyDto | null): void {
    this.form.reset();
    this.form.controls.isDefault.enable();
    if (p) {
      this.form.patchValue({
        name: p.name ?? '',
        description: p.description ?? '',
        isDefault: !!p.isDefault,
        isActive: p.isActive ?? true,
        firstWarningKm: p.firstWarningKm ?? POLICY_DEFAULTS.firstWarningKm,
        secondWarningKm: p.secondWarningKm ?? POLICY_DEFAULTS.secondWarningKm,
        criticalKm: p.criticalKm ?? POLICY_DEFAULTS.criticalKm,
        maxKm: p.maxKm ?? POLICY_DEFAULTS.maxKm,
        overdueFinePerKm: p.overdueFinePerKm ?? 0,
        firstWarningRecipients: parseRecipients(p.firstWarningRecipients),
        secondWarningRecipients: parseRecipients(p.secondWarningRecipients),
        criticalRecipients: parseRecipients(p.criticalRecipients),
        overdueRecipients: parseRecipients(p.overdueRecipients),
        criticalReminderIntervalHours: p.criticalReminderIntervalHours ?? 24,
        notifyOnlyHighestWhenSkipping: p.notifyOnlyHighestWhenSkipping ?? true,
      });
      // The default can't be "un-defaulted" directly — another policy must take over.
      if (p.isDefault) this.form.controls.isDefault.disable();
    } else {
      this.form.patchValue({
        isDefault: !this.currentDefault(),
        firstWarningRecipients: ['Driver'],
        secondWarningRecipients: ['Driver', 'MaintenanceOfficer'],
        criticalRecipients: ['Driver', 'Admin', 'MaintenanceOfficer'],
        overdueRecipients: ['Driver', 'Admin', 'MaintenanceOfficer'],
      });
    }
  }

  protected recipients(control: RecipientControl): string[] {
    return this.form.controls[control].value;
  }

  protected setRecipients(
    control: RecipientControl,
    list: string[],
  ): void {
    this.form.controls[control].setValue(list);
    this.form.controls[control].markAsDirty();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SaveMaintenancePolicyRequest = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      isDefault: v.isDefault,
      isActive: v.isActive,
      firstWarningKm: Math.round(v.firstWarningKm),
      secondWarningKm: Math.round(v.secondWarningKm),
      criticalKm: Math.round(v.criticalKm),
      maxKm: Math.round(v.maxKm),
      overdueFinePerKm: v.overdueFinePerKm,
      firstWarningRecipients: serializeRecipients(v.firstWarningRecipients),
      secondWarningRecipients: serializeRecipients(v.secondWarningRecipients),
      criticalRecipients: serializeRecipients(v.criticalRecipients),
      overdueRecipients: serializeRecipients(v.overdueRecipients),
      criticalReminderIntervalHours: Math.round(v.criticalReminderIntervalHours),
      notifyOnlyHighestWhenSkipping: v.notifyOnlyHighestWhenSkipping,
    };

    const editing = this.policy();
    this.saving.set(true);
    const request$ = editing ? this.api.update(editing.id, body) : this.api.create(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'تم حفظ السياسة' : 'تمت إضافة السياسة');
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
