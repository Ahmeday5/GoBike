import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { APP_ROUTES } from '@core/constants/app-routes';
import { OIL_CHANGE_STATUS } from '@core/constants/enums';
import { ApiError } from '@core/models/api-response.model';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatKm, formatMoney } from '@core/utils/format.util';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import { OilChangesApi } from '../../data-access/oil-changes.api';
import { OilVideoPlayerComponent } from '../../components/oil-video-player/oil-video-player.component';
import {
  DEFAULT_OIL_THRESHOLDS,
  FineEstimate,
  oilLevelClass,
} from '../../models/oil-change.models';

/** 5.8 — Watch one oil-change video and approve (fine preview first) or reject it. */
@Component({
  selector: 'app-oil-change-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    PageHeaderComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    ModalComponent,
    FormErrorComponent,
    OilVideoPlayerComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './oil-change-review.component.html',
  styleUrl: './oil-change-review.component.scss',
})
export class OilChangeReviewComponent {
  private readonly api = inject(OilChangesApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly STATUS = OIL_CHANGE_STATUS;
  protected readonly ROUTES = APP_ROUTES;
  protected readonly levelClass = oilLevelClass;

  /** The queue URL (with its filters) we came from — decisions return there. */
  private readonly queueUrl: string =
    (history.state as { queueUrl?: string } | null)?.queueUrl ?? APP_ROUTES.oilChanges;

  protected readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly submission = createResource(
    () => this.id() || null,
    (id) => this.api.get(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly s = computed(() => this.submission.value());
  protected readonly isPending = computed(() => this.s()?.status === 'Pending');

  /** Policy max km / price per km for the fine preview — best-effort. */
  private readonly overview = createResource(
    () => this.s()?.motorcycleId ?? null,
    (motorcycleId) => this.api.oilOverview(motorcycleId).pipe(catchError(() => of(null))),
  );

  protected readonly fine = computed<FineEstimate | null>(() => {
    const s = this.s();
    if (!s) return null;
    const oil = this.overview.value()?.oilStatus;
    const policyMax = oil?.maxKm ?? null;
    const maxKm = policyMax ?? DEFAULT_OIL_THRESHOLDS.maxKm;
    const rate = s.fineRatePerKm ?? oil?.finePerKm ?? null;
    const overKm = Math.max(0, Math.floor((s.kmAtSubmit ?? 0) - maxKm));
    const amount = overKm === 0 ? 0 : rate != null ? Math.round(overKm * rate * 100) / 100 : null;
    return { overKm, rate, amount, maxKm, assumedMax: policyMax == null };
  });
  protected readonly fineLoading = computed(() => this.overview.loading() && !this.s()?.fineRatePerKm);

  /** Another pending video in the same queue scope, for the "التالي" button. */
  private readonly queueScope = (() => {
    const q = this.router.parseUrl(this.queueUrl).queryParams;
    return {
      officeId: (q['officeId'] as string) ?? '',
      motorcycleId: (q['motorcycleId'] as string) ?? '',
      driverId: (q['driverId'] as string) ?? '',
    };
  })();
  private readonly pendingPeek = createResource(
    () => this.id() || null,
    () =>
      this.api
        .list({ ...this.queueScope, status: 'Pending', pageIndex: 1, pageSize: 3 })
        .pipe(catchError(() => of(null))),
  );
  protected readonly nextId = computed(
    () => this.pendingPeek.value()?.data.find((x) => x.id !== this.id())?.id ?? null,
  );

  protected readonly approving = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly rejecting = signal(false);

  protected readonly approveForm = this.fb.nonNullable.group({ notes: ['', Validators.maxLength(500)] });
  protected readonly rejectForm = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    // Fresh forms for every submission (the component is reused by "التالي").
    effect(() => {
      this.id();
      untracked(() => {
        this.approveForm.reset();
        this.rejectForm.reset();
        this.rejectOpen.set(false);
      });
    });
  }

  protected backToQueue(): void {
    void this.router.navigateByUrl(this.queueUrl);
  }

  protected goNext(): void {
    const next = this.nextId();
    if (next) this.openSubmission(next);
  }

  protected async approve(): Promise<void> {
    const s = this.s();
    const fine = this.fine();
    if (!s || !fine) return;

    const plate = s.plateNumber ?? '';
    const driver = s.driverName ?? 'السائق';
    let fineText: string;
    if (fine.overKm === 0) {
      fineText = 'بدون غرامة — لم يتجاوز السائق الحد المسموح.';
    } else if (fine.amount != null) {
      fineText =
        `تجاوز السائق الحد بمقدار ${formatKm(fine.overKm)} (${formatKm(fine.overKm)} × ${formatMoney(fine.rate)})، ` +
        `لذا ستُسجَّل غرامة ${formatMoney(fine.amount)} مديونيةً على ${driver}.`;
    } else {
      fineText =
        `تجاوز السائق الحد بمقدار ${formatKm(fine.overKm)} تقريبًا، وسيحسب النظام الغرامة حسب سعر الكيلو ` +
        `في سياسة الزيت ويسجّلها مديونيةً على ${driver}.`;
    }

    const ok = await this.dialog.confirm({
      title: 'اعتماد تغيير الزيت',
      message: `سيتم اعتماد تغيير الزيت للموتوسيكل ${plate} وتصفير عدّاد الزيت إلى 0 كم. ${fineText}`,
      type: fine.overKm > 0 ? 'warning' : 'info',
      confirmText: fine.amount ? `اعتماد وتسجيل ${formatMoney(fine.amount)}` : 'اعتماد',
    });
    if (!ok) return;

    const notes = this.approveForm.getRawValue().notes.trim();
    this.approving.set(true);
    this.api.approve(s.id, { notes: notes || null }).subscribe({
      next: (res) => {
        this.approving.set(false);
        const amount = res?.fineAmount ?? fine.amount;
        this.toast.success(
          amount ? `تم الاعتماد وتسجيل غرامة ${formatMoney(amount)} على السائق` : 'تم اعتماد تغيير الزيت',
        );
        this.afterDecision();
      },
      error: () => this.approving.set(false),
    });
  }

  protected openReject(): void {
    this.rejectForm.reset();
    this.rejectOpen.set(true);
  }

  protected reject(): void {
    const s = this.s();
    if (!s) return;
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    const reason = this.rejectForm.getRawValue().reason.trim();
    this.rejecting.set(true);
    this.api.reject(s.id, { reason }).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.rejectOpen.set(false);
        this.toast.success('تم رفض الفيديو وسيُطلب من السائق رفع فيديو أوضح');
        this.afterDecision();
      },
      error: (err: ApiError) => {
        this.rejecting.set(false);
        applyServerErrors(this.rejectForm, err, this.toast);
      },
    });
  }

  /** Advance to the next pending video in the same queue, or back to the queue when none is left. */
  private afterDecision(): void {
    const current = this.id();
    this.api
      .list({ ...this.queueScope, status: 'Pending', pageIndex: 1, pageSize: 3 })
      .pipe(catchError(() => of(null)))
      .subscribe((page) => {
        const next = page?.data.find((x) => x.id !== current);
        if (next) this.openSubmission(next.id);
        else {
          this.toast.info('لا توجد فيديوهات أخرى بانتظار المراجعة');
          this.backToQueue();
        }
      });
  }

  private openSubmission(id: string): void {
    void this.router.navigateByUrl(APP_ROUTES.oilChange(id), {
      state: { queueUrl: this.queueUrl },
      replaceUrl: true,
    });
  }
}
