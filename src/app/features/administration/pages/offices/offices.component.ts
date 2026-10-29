import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { ApiError } from '@core/models/api-response.model';
import { OfficeDto } from '@core/models/domain.models';
import { injectUrlState } from '@core/routing/url-state';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import {
  DataTableComponent,
  SortState,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { OfficesApi } from '../../data-access/offices.api';
import {
  OFFICES_QUERY_DEFAULTS,
  OfficesQuery,
  SaveOfficeRequest,
} from '../../models/office.models';
import { OfficeFormDialogComponent } from '../../components/office-form-dialog/office-form-dialog.component';
import { OfficeDetailsDialogComponent } from '../../components/office-details-dialog/office-details-dialog.component';

type Row = TemplateRef<{ $implicit: OfficeDto }>;

const toSaveRequest = (o: OfficeDto, isActive: boolean): SaveOfficeRequest => ({
  name: o.name,
  code: o.code ?? null,
  city: o.city ?? null,
  address: o.address ?? null,
  phone: o.phone ?? null,
  email: o.email ?? null,
  managerUserId: o.managerUserId ?? null,
  isActive,
  notes: o.notes ?? null,
});

/** Settings → Offices: branches, their manager and live counters. */
@Component({
  selector: 'app-offices',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    ChipComponent,
    IconComponent,
    HasPermissionDirective,
    OfficeFormDialogComponent,
    OfficeDetailsDialogComponent,
  ],
  templateUrl: './offices.component.html',
  styleUrls: ['../../styles/row-actions.scss'],
})
export class OfficesComponent {
  private readonly api = inject(OfficesApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly lookups = inject(LookupService);

  protected readonly P = PERMISSIONS;
  protected readonly filters = injectUrlState<OfficesQuery>(OFFICES_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly canManage = computed(() => {
    this.auth.permissionSet();
    return this.auth.hasPermission(PERMISSIONS.Offices.Manage);
  });

  protected readonly offices = createResource(
    () => this.f(),
    (q) => this.api.list(q),
  );
  protected readonly rows = computed(() => this.offices.value()?.data ?? []);
  protected readonly page = computed(() => this.offices.value());
  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.search || f.isActive || f.city);
  });

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<OfficeDto | null>(null);
  protected readonly viewing = signal<OfficeDto | null>(null);
  protected readonly busyId = signal<string | null>(null);

  private readonly nameTpl = viewChild<Row>('nameTpl');
  private readonly managerTpl = viewChild<Row>('managerTpl');
  private readonly phoneTpl = viewChild<Row>('phoneTpl');
  private readonly activeTpl = viewChild<Row>('activeTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<OfficeDto>[]>(() => [
    { key: 'name', label: 'المكتب', sortKey: 'name', cellTemplate: this.nameTpl() },
    { key: 'city', label: 'المدينة', sortKey: 'city' },
    { key: 'managerName', label: 'المدير', cellTemplate: this.managerTpl() },
    { key: 'phone', label: 'الهاتف', cellTemplate: this.phoneTpl() },
    { key: 'isActive', label: 'الحالة', cellTemplate: this.activeTpl() },
    { key: 'actions', label: 'إجراءات', align: 'end', cellTemplate: this.actionsTpl() },
  ]);

  protected selectActive(event: Event): void {
    this.filters.patch({
      isActive: (event.target as HTMLSelectElement).value as OfficesQuery['isActive'],
    });
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as OfficesQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(o: OfficeDto): void {
    this.viewing.set(null);
    this.editing.set(o);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.offices.reload();
  }

  protected async toggleActive(o: OfficeDto): Promise<void> {
    const activating = !o.isActive;
    const ok = await this.dialog.confirm(
      activating
        ? {
            title: 'تفعيل المكتب؟',
            message: `سيعود «${o.name}» للظهور في قوائم الاختيار عند إضافة موتوسيكلات وسائقين ومستخدمين.`,
            type: 'info',
            confirmText: 'تفعيل',
          }
        : {
            title: 'إيقاف المكتب؟',
            message: `لن يظهر «${o.name}» في قوائم الاختيار للإضافات الجديدة. تبقى موتوسيكلاته وسائقوه وسجلاته كما هي.`,
            type: 'warning',
            confirmText: 'إيقاف المكتب',
          },
    );
    if (!ok) return;
    this.busyId.set(o.id);
    this.api.update(o.id, toSaveRequest(o, activating)).subscribe({
      next: () => {
        this.busyId.set(null);
        this.lookups.invalidate();
        this.toast.success(activating ? 'تم تفعيل المكتب' : 'تم إيقاف المكتب');
        this.offices.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.toast.error(err.message);
      },
    });
  }

  protected async remove(o: OfficeDto): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف المكتب؟',
      message:
        `سيُحذف «${o.name}» نهائيًا. لا يمكن حذف مكتب له موتوسيكلات أو سائقون أو مستخدمون؛ ` +
        'في هذه الحالة أوقفه بدلًا من حذفه.',
      type: 'danger',
      confirmText: 'حذف المكتب',
    });
    if (!ok) return;
    this.busyId.set(o.id);
    this.api.delete(o.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.lookups.invalidate();
        this.toast.success('تم حذف المكتب');
        this.offices.reload();
      },
      error: () => this.busyId.set(null),
    });
  }
}
