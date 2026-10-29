import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/constants/app-routes';
import { GPS_CONNECTIVITY, enumOptions } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
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
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { GpsDevicesApi } from '../../data-access/gps-devices.api';
import {
  GPS_DEVICES_QUERY_DEFAULTS,
  GpsDeviceDto,
  GpsDevicesQuery,
  deviceBattery,
  deviceConnectivity,
  deviceLastSeen,
  deviceModel,
  deviceName,
  devicePlate,
} from '../../models/gps-device.models';
import { GpsDeviceFormDialogComponent } from '../../components/gps-device-form-dialog/gps-device-form-dialog.component';
import { GpsLinkDialogComponent } from '../../components/gps-link-dialog/gps-link-dialog.component';

type Row = TemplateRef<{ $implicit: GpsDeviceDto }>;

/** Settings → GPS trackers: register, edit, link to / unlink from motorcycles. */
@Component({
  selector: 'app-gps-devices',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DataTableComponent,
    PaginationComponent,
    PageHeaderComponent,
    SearchInputComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    CairoDatePipe,
    GpsDeviceFormDialogComponent,
    GpsLinkDialogComponent,
  ],
  templateUrl: './gps-devices.component.html',
  styleUrls: ['../../styles/row-actions.scss', './gps-devices.component.scss'],
})
export class GpsDevicesComponent {
  private readonly api = inject(GpsDevicesApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly CONNECTIVITY = GPS_CONNECTIVITY;
  protected readonly connectivityOptions = enumOptions(GPS_CONNECTIVITY);
  protected readonly name = deviceName;
  protected readonly model = deviceModel;
  protected readonly plate = devicePlate;
  protected readonly connectivity = deviceConnectivity;
  protected readonly lastSeen = deviceLastSeen;
  protected readonly battery = deviceBattery;
  protected readonly motorcycleLink = (id: string) => APP_ROUTES.motorcycle(id);

  protected readonly filters = injectUrlState<GpsDevicesQuery>(GPS_DEVICES_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly devices = createResource(
    () => this.f(),
    (q) => this.api.list(q),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly rows = computed(() => this.devices.value()?.data ?? []);
  protected readonly page = computed(() => this.devices.value());
  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.search || f.isLinked || f.isActive || f.connectivity || f.staleOnly);
  });

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<GpsDeviceDto | null>(null);
  protected readonly linking = signal<GpsDeviceDto | null>(null);
  protected readonly busyId = signal<string | null>(null);

  private readonly deviceTpl = viewChild<Row>('deviceTpl');
  private readonly bikeTpl = viewChild<Row>('bikeTpl');
  private readonly connTpl = viewChild<Row>('connTpl');
  private readonly seenTpl = viewChild<Row>('seenTpl');
  private readonly batteryTpl = viewChild<Row>('batteryTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<GpsDeviceDto>[]>(() => [
    { key: 'imei', label: 'الجهاز', sortKey: 'imei', cellTemplate: this.deviceTpl() },
    { key: 'motorcycleId', label: 'الموتوسيكل', cellTemplate: this.bikeTpl() },
    { key: 'connectivity', label: 'الاتصال', cellTemplate: this.connTpl() },
    { key: 'lastSeenAtUtc', label: 'آخر إشارة', sortKey: 'lastSeen', cellTemplate: this.seenTpl() },
    { key: 'battery', label: 'البطارية', cellTemplate: this.batteryTpl() },
    { key: 'actions', label: 'إجراءات', align: 'end', cellTemplate: this.actionsTpl() },
  ]);

  protected select(field: keyof GpsDevicesQuery, event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<GpsDevicesQuery>);
  }

  protected sort(s: SortState): void {
    this.filters.patch({ sortBy: s.sortBy as GpsDevicesQuery['sortBy'], sortDesc: s.sortDesc });
  }

  protected batteryTone(v: number): 'success' | 'warning' | 'danger' {
    return v <= 20 ? 'danger' : v <= 50 ? 'warning' : 'success';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(d: GpsDeviceDto): void {
    this.editing.set(d);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.devices.reload();
  }

  protected onLinked(): void {
    this.linking.set(null);
    this.devices.reload();
  }

  protected async unlink(d: GpsDeviceDto): Promise<void> {
    const plate = devicePlate(d);
    const ok = await this.dialog.confirm({
      title: 'فصل الجهاز عن الموتوسيكل؟',
      message:
        `سيُفصل الجهاز ${deviceName(d) || d.imei} عن ${plate ? `الموتوسيكل ${plate}` : 'الموتوسيكل المرتبط به'}. ` +
        'سيختفي الموتوسيكل من الخريطة المباشرة وتتوقف تنبيهات التتبع والنطاق له حتى يُربط بجهاز آخر.',
      type: 'warning',
      confirmText: 'فصل الجهاز',
    });
    if (!ok) return;
    this.busyId.set(d.id);
    this.api.unlink(d.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('تم فصل الجهاز');
        this.devices.reload();
      },
      error: () => this.busyId.set(null),
    });
  }
}
