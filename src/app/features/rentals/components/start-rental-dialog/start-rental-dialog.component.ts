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
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { ApiError } from '@core/models/api-response.model';
import { DriverDto, MotorcycleDto, RentalDto } from '@core/models/domain.models';
import { RENT_PERIOD, RentPeriod, enumLabel, enumOptions } from '@core/constants/enums';
import { cairoInputToUtc, cairoNowInput } from '@core/utils/cairo-time.util';
import { formatMoney } from '@core/utils/format.util';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { applyServerErrors } from '@shared/forms/server-errors';
import { RentalsApi } from '../../data-access/rentals.api';
import { StartRentalRequest } from '../../models/rental.models';
import { PickerOption, RemotePickerComponent } from '../remote-picker/remote-picker.component';

/** Start a rental (assignments.manage). Only `Available` motorcycles are offered. */
@Component({
  selector: 'app-start-rental-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    IconComponent,
    MoneyPipe,
    RemotePickerComponent,
  ],
  templateUrl: './start-rental-dialog.component.html',
  styleUrl: './start-rental-dialog.component.scss',
})
export class StartRentalDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RentalsApi);
  private readonly lookups = inject(LookupService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly started = output<RentalDto>();

  protected readonly periodOptions = enumOptions(RENT_PERIOD);
  protected readonly saving = signal(false);
  protected readonly motorcycle = signal<MotorcycleDto | null>(null);
  protected readonly driver = signal<DriverDto | null>(null);

  protected readonly searchMotorcycles = (term: string) =>
    this.lookups.motorcycles(term, true).pipe(
      map((rows) =>
        rows.map(
          (m): PickerOption<MotorcycleDto> => ({
            value: m.id,
            label: m.plateNumber,
            hint: [m.brand, m.model, m.officeName].filter(Boolean).join(' · '),
            data: m,
          }),
        ),
      ),
    );

  protected readonly searchDrivers = (term: string) =>
    this.lookups.drivers(term).pipe(
      map((rows) =>
        rows.map(
          (d): PickerOption<DriverDto> => ({
            value: d.id,
            label: d.fullName,
            hint: d.phoneNumber + (d.hasActiveAssignment ? ' · لديه إيجار سارٍ' : ''),
            data: d,
          }),
        ),
      ),
    );

  protected readonly form = this.fb.nonNullable.group({
    motorcycleId: ['', Validators.required],
    driverId: ['', Validators.required],
    startAt: ['', Validators.required],
    contractNumber: ['', Validators.maxLength(50)],
    rentAmount: [0, [Validators.required, Validators.min(0.01)]],
    rentPeriod: ['Daily' as RentPeriod, Validators.required],
    depositAmount: [0, [Validators.required, Validators.min(0)]],
    terms: [''],
    notes: [''],
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly periodLabel = computed(() =>
    enumLabel(RENT_PERIOD, this.values().rentPeriod),
  );
  protected readonly amounts = computed(() => ({
    rent: Number(this.values().rentAmount) || 0,
    deposit: Number(this.values().depositAmount) || 0,
  }));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.form.reset({ startAt: cairoNowInput(), rentPeriod: 'Daily' });
        this.motorcycle.set(null);
        this.driver.set(null);
      });
    });
  }

  protected onMotorcycle(o: PickerOption | null): void {
    this.motorcycle.set((o?.data as MotorcycleDto | undefined) ?? null);
  }

  protected onDriver(o: PickerOption | null): void {
    this.driver.set((o?.data as DriverDto | undefined) ?? null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const m = this.motorcycle();
    const d = this.driver();
    const ok = await this.dialog.confirm({
      title: 'تأكيد بدء الإيجار',
      message:
        `سيتم تسليم الموتوسيكل ${m?.plateNumber ?? ''} للسائق ${d?.fullName ?? ''} ` +
        `بإيجار ${formatMoney(Number(v.rentAmount))} (${enumLabel(RENT_PERIOD, v.rentPeriod)}) ` +
        `وتأمين ${formatMoney(Number(v.depositAmount))}. ستتحول حالة الموتوسيكل إلى «مؤجرة».`,
      type: 'info',
      confirmText: 'بدء الإيجار',
    });
    if (!ok) return;

    const body: StartRentalRequest = {
      motorcycleId: v.motorcycleId,
      driverId: v.driverId,
      startAtUtc: cairoInputToUtc(v.startAt),
      contractNumber: v.contractNumber.trim() || null,
      rentAmount: Number(v.rentAmount),
      rentPeriod: v.rentPeriod,
      depositAmount: Number(v.depositAmount),
      terms: v.terms.trim() || null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api.start(body).subscribe({
      next: (rental) => {
        this.saving.set(false);
        this.toast.success('تم بدء الإيجار بنجاح');
        this.started.emit(rental);
      },
      error: (err: ApiError) => {
        this.saving.set(false);
        applyServerErrors(this.form, err, this.toast);
      },
    });
  }
}
