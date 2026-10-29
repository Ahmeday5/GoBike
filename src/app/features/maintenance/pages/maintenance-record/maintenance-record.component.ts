import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { FAULT_SEVERITY, MAINTENANCE_STATUS, MAINTENANCE_TYPE } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { ConfirmDialogConfig, DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DocumentsPanelComponent } from '@shared/components/documents-panel/documents-panel.component';
import { ReasonDialogComponent } from '@shared/components/reason-dialog/reason-dialog.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { FORMAT_PIPES } from '@shared/pipes/format.pipes';
import { MaintenanceApi } from '../../data-access/maintenance.api';
import {
  canWriteReport,
  isReturned,
  lineTotal,
  partsTotal,
  recordTotal,
} from '../../models/maintenance.models';
import { TechnicianReportComponent } from '../../components/technician-report/technician-report.component';
import { RecordFormDialogComponent } from '../../components/record-form-dialog/record-form-dialog.component';
import { CompleteRecordDialogComponent } from '../../components/complete-record-dialog/complete-record-dialog.component';

/**
 * 5.7 — One maintenance record. Repairs from a return inspection
 * (`requiresSupervisorApproval`) follow technician report → supervisor
 * verification; general records use edit / start / complete / cancel.
 */
@Component({
  selector: 'app-maintenance-record',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    ChipComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    DocumentsPanelComponent,
    ReasonDialogComponent,
    HasPermissionDirective,
    TechnicianReportComponent,
    RecordFormDialogComponent,
    CompleteRecordDialogComponent,
    ...FORMAT_PIPES,
  ],
  templateUrl: './maintenance-record.component.html',
  styleUrl: './maintenance-record.component.scss',
})
export class MaintenanceRecordComponent {
  private readonly api = inject(MaintenanceApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly hub = inject(DashboardHubService);

  /** Route param (component input binding). */
  readonly id = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly ROUTES = APP_ROUTES;
  protected readonly STATUS = MAINTENANCE_STATUS;
  protected readonly TYPE = MAINTENANCE_TYPE;
  protected readonly SEVERITY = FAULT_SEVERITY;
  protected readonly lineTotal = lineTotal;

  protected readonly recordRes = createResource(
    () => this.id() || null,
    (id) => this.api.get(id),
    { refetchOn: merge(this.hub.reconnected$, this.hub.notification$) },
  );
  protected readonly record = computed(() => this.recordRes.value() ?? null);
  protected readonly notFound = computed(() => {
    const s = this.recordRes.error()?.status;
    return s === 404 || s === 403;
  });

  private readonly can = (p: string) => this.auth.hasPermission(p);

  protected readonly isRepairFlow = computed(() => !!this.record()?.requiresSupervisorApproval);
  protected readonly isOpen = computed(() => {
    const s = this.record()?.status;
    return !!s && s !== 'Completed' && s !== 'Cancelled';
  });
  protected readonly returned = computed(() => {
    const r = this.record();
    return !!r && isReturned(r);
  });
  /** Reject reason still on a resubmitted repair — shown as a softer note. */
  protected readonly resubmittedAfterReject = computed(() => {
    const r = this.record();
    return !!r?.verificationRejectReason && r.status === 'AwaitingSupervisorApproval';
  });

  protected readonly canReport = computed(() => {
    const r = this.record();
    return !!r && canWriteReport(r) && this.can(PERMISSIONS.Maintenance.Manage);
  });
  protected readonly canVerify = computed(
    () =>
      this.record()?.status === 'AwaitingSupervisorApproval' &&
      this.can(PERMISSIONS.Maintenance.Verify),
  );
  private readonly canManageGeneral = computed(
    () => !this.isRepairFlow() && this.isOpen() && this.can(PERMISSIONS.Maintenance.Manage),
  );
  protected readonly canEdit = this.canManageGeneral;
  protected readonly canCancel = this.canManageGeneral;
  protected readonly canStart = computed(
    () => this.canManageGeneral() && this.record()?.status === 'Scheduled',
  );
  protected readonly canComplete = computed(
    () => this.canManageGeneral() && this.record()?.status === 'InProgress',
  );

  protected readonly faults = computed(() => this.record()?.faults ?? []);
  protected readonly parts = computed(() => this.record()?.parts ?? []);
  protected readonly fixedCount = computed(() => this.faults().filter((f) => f.isFixed).length);
  protected readonly costs = computed(() => {
    const r = this.record();
    if (!r) return null;
    return {
      labor: r.laborCost ?? 0,
      other: r.otherCost ?? 0,
      parts: partsTotal(r),
      total: recordTotal(r),
    };
  });

  // ── dialogs ──
  protected readonly editOpen = signal(false);
  protected readonly completeOpen = signal(false);
  protected readonly cancelOpen = signal(false);
  protected readonly rejectOpen = signal(false);
  protected readonly approving = signal(false);
  protected readonly starting = signal(false);

  protected readonly cancelAction = (reason: string) => this.api.cancel(this.id(), { reason });
  protected readonly rejectAction = (reason: string) =>
    this.api.verify(this.id(), { approved: false, reason });

  protected readonly rejectConfirm = computed<ConfirmDialogConfig>(() => ({
    title: 'رفض الإصلاح',
    message:
      `سيُعاد إصلاح الموتوسيكل ${this.record()?.plateNumber ?? ''} إلى الفني مع سبب الرفض، ` +
      'وتبقى الموتوسيكل حمراء وغير متاحة للتأجير.',
    type: 'warning',
    confirmText: 'رفض وإعادة للفني',
  }));

  protected reload(): void {
    this.recordRes.reload();
  }

  protected onReportSaved(): void {
    this.reload();
  }

  protected async approve(): Promise<void> {
    const r = this.record();
    const c = this.costs();
    if (!r || !c) return;
    const ok = await this.dialog.confirm({
      title: 'اعتماد الإصلاح',
      message:
        `سيُعتمد إصلاح الموتوسيكل ${r.plateNumber ?? ''} ` +
        `(${this.fixedCount()} من ${this.faults().length} عطل مُصلَح، التكلفة ${formatMoney(c.total)}). ` +
        'ستعود الموتوسيكل خضراء (سليمة) ومتاحة للتأجير فورًا، ويُغلق سجل الإصلاح.',
      type: 'info',
      confirmText: 'اعتماد — الموتوسيكل متاحة',
    });
    if (!ok) return;
    this.approving.set(true);
    this.api.verify(r.id, { approved: true }).subscribe({
      next: () => {
        this.approving.set(false);
        this.toast.success('تم اعتماد الإصلاح وأصبحت الموتوسيكل متاحة');
        this.reload();
      },
      error: () => this.approving.set(false),
    });
  }

  protected onRejected(): void {
    this.rejectOpen.set(false);
    this.reload();
  }

  protected async start(): Promise<void> {
    const r = this.record();
    if (!r) return;
    const ok = await this.dialog.confirm({
      title: 'بدء الصيانة',
      message: `سيتحول سجل صيانة الموتوسيكل ${r.plateNumber ?? ''} إلى "جارية".`,
      type: 'info',
      confirmText: 'بدء',
    });
    if (!ok) return;
    this.starting.set(true);
    this.api.start(r.id).subscribe({
      next: () => {
        this.starting.set(false);
        this.toast.success('بدأت الصيانة');
        this.reload();
      },
      error: () => this.starting.set(false),
    });
  }

  protected onEdited(): void {
    this.editOpen.set(false);
    this.reload();
  }

  protected onCompleted(): void {
    this.completeOpen.set(false);
    this.reload();
  }

  protected onCancelled(): void {
    this.cancelOpen.set(false);
    this.reload();
  }
}
