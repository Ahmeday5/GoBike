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
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { map, startWith } from 'rxjs';
import { ApiError } from '@core/models/api-response.model';
import { MaintenanceRecordDto, PartDto } from '@core/models/domain.models';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import {
  FaultFormGroup,
  FaultsEditorComponent,
  createFaultGroup,
  faultsPayload,
} from '@shared/components/faults-editor/faults-editor.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { MaintenanceApi } from '../../data-access/maintenance.api';
import {
  ReportFault,
  TechnicianReportRequest,
  lineTotal,
  moneyOrNull,
  round2,
} from '../../models/maintenance.models';

type PartFormGroup = FormGroup<{
  partName: FormControl<string>;
  partNumber: FormControl<string>;
  quantity: FormControl<number | null>;
  unitCost: FormControl<number | null>;
}>;

function createPartGroup(p?: Partial<PartDto> | null): PartFormGroup {
  return new FormGroup({
    partName: new FormControl(p?.partName ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    partNumber: new FormControl(p?.partNumber ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    quantity: new FormControl<number | null>(p?.quantity ?? 1, [
      Validators.required,
      Validators.min(0.01),
    ]),
    unitCost: new FormControl<number | null>(p?.unitCost ?? null, [
      Validators.required,
      Validators.min(0),
    ]),
  });
}

/**
 * Technician report for a repair opened by a return inspection
 * (`PUT /maintenance/records/{id}/report`, maintenance.manage). "Save progress"
 * keeps the record with the technician; "Repair done" sends it to the
 * supervisor (status AwaitingSupervisorApproval — the bike stays red until
 * the supervisor approves).
 */
@Component({
  selector: 'app-technician-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FaultsEditorComponent,
    FormErrorComponent,
    IconComponent,
    MoneyPipe,
  ],
  templateUrl: './technician-report.component.html',
  styleUrl: './technician-report.component.scss',
})
export class TechnicianReportComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MaintenanceApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly record = input.required<MaintenanceRecordDto>();
  readonly saved = output<{ repairDone: boolean }>();

  /** Which button is busy. */
  protected readonly saving = signal<'progress' | 'done' | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    faults: new FormArray<FaultFormGroup>([]),
    parts: new FormArray<PartFormGroup>([]),
    workPerformed: ['', Validators.maxLength(2000)],
    technician: ['', Validators.maxLength(200)],
    laborCost: [null as number | null, Validators.min(0)],
    otherCost: [null as number | null, Validators.min(0)],
  });

  /** Form arrays aren't signals: re-read the raw value on every change. */
  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly partRows = computed(() => {
    this.values();
    return [...this.form.controls.parts.controls];
  });

  protected readonly totals = computed(() => {
    const v = this.values();
    const lines = v.parts.map((p) => lineTotal(p.quantity, p.unitCost));
    const parts = round2(lines.reduce((a, b) => a + b, 0));
    const labor = moneyOrNull(v.laborCost) ?? 0;
    const other = moneyOrNull(v.otherCost) ?? 0;
    return { lines, parts, labor, other, total: round2(parts + labor + other) };
  });

  protected readonly faultStats = computed(() => {
    const faults = this.values().faults;
    return { total: faults.length, fixed: faults.filter((f) => f.isFixed).length };
  });

  constructor() {
    // Prefill from the record whenever a fresh copy arrives (after save/reload) —
    // but never wipe unsaved edits because a background refetch landed.
    let lastId: string | null = null;
    effect(() => {
      const r = this.record();
      untracked(() => {
        if (r.id === lastId && this.form.dirty) return;
        lastId = r.id;
        this.prefill(r);
      });
    });
  }

  protected addPart(): void {
    this.form.controls.parts.push(createPartGroup());
    const id = `tr-part-name-${this.form.controls.parts.length - 1}`;
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  protected removePart(index: number): void {
    this.form.controls.parts.removeAt(index);
    this.form.markAsDirty();
  }

  protected saveProgress(): void {
    if (!this.validate()) return;
    this.send(false);
  }

  protected async markDone(): Promise<void> {
    if (!this.validate()) return;
    const { total, fixed } = this.faultStats();
    const t = this.totals();
    const plate = this.record().plateNumber ?? '';
    const unfixed = total - fixed;
    const ok = await this.dialog.confirm({
      title: 'إنهاء الإصلاح وإرساله للمشرف',
      message:
        `سيُرسل تقرير إصلاح الموتوسيكل ${plate} إلى المشرف للاعتماد ` +
        `(${fixed} من ${total} عطل تم إصلاحه، الإجمالي ${formatMoney(t.total)}). ` +
        (unfixed > 0 ? `تنبيه: يوجد ${unfixed} عطل غير مُعلَّم كمُصلَح. ` : '') +
        'لن تتمكن من تعديل التقرير إلا إذا رفضه المشرف، وتبقى الموتوسيكل حمراء حتى يعتمده.',
      type: unfixed > 0 ? 'warning' : 'info',
      confirmText: 'إرسال للمشرف',
    });
    if (!ok) return;
    this.send(true);
  }

  private validate(): boolean {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('راجع الحقول المطلوبة في التقرير');
      return false;
    }
    return true;
  }

  private send(repairDone: boolean): void {
    const r = this.record();
    const v = this.form.getRawValue();
    const body: TechnicianReportRequest = {
      faults: faultsPayload(this.form.controls.faults, true) as ReportFault[],
      parts: v.parts.map((p) => ({
        partName: p.partName.trim(),
        partNumber: p.partNumber.trim() || null,
        quantity: Number(p.quantity) || 0,
        unitCost: Number(p.unitCost) || 0,
      })),
      workPerformed: v.workPerformed.trim() || null,
      technician: v.technician.trim() || null,
      laborCost: moneyOrNull(v.laborCost),
      otherCost: moneyOrNull(v.otherCost),
      repairDone,
      ...(r.rowVersion ? { rowVersion: r.rowVersion } : {}),
    };
    this.saving.set(repairDone ? 'done' : 'progress');
    this.api.report(r.id, body).subscribe({
      next: () => {
        this.saving.set(null);
        this.form.markAsPristine();
        this.toast.success(
          repairDone ? 'تم إرسال الإصلاح للمشرف للاعتماد' : 'تم حفظ التقدم في تقرير الإصلاح',
        );
        this.saved.emit({ repairDone });
      },
      error: (err: ApiError) => {
        this.saving.set(null);
        if (err.status === 409) {
          this.toast.error('عدّل مستخدم آخر هذا السجل للتو. أعد تحميل الصفحة ثم أعد المحاولة.');
          return;
        }
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }

  private prefill(r: MaintenanceRecordDto): void {
    const c = this.form.controls;
    c.faults.clear({ emitEvent: false });
    for (const f of r.faults ?? []) c.faults.push(createFaultGroup(f), { emitEvent: false });
    c.parts.clear({ emitEvent: false });
    for (const p of r.parts ?? []) c.parts.push(createPartGroup(p), { emitEvent: false });
    this.form.reset({
      faults: c.faults.getRawValue(),
      parts: c.parts.getRawValue(),
      workPerformed: r.workPerformed ?? '',
      technician: r.technician ?? '',
      laborCost: r.laborCost ?? null,
      otherCost: r.otherCost ?? null,
    });
  }
}
