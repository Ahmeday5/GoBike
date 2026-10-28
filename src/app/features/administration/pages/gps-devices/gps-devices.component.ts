import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { GpsDevicesApi } from '../../data-access/gps-devices.api';
import { GPS_DEVICES_QUERY_DEFAULTS, deviceName } from '../../models/gps-device.models';

@Component({
  selector: 'app-gps-devices',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="أجهزة التتبع" subtitle="إدارة أجهزة GPS وربطها بالموتوسيكلات" />
    @if (devices.loading()) { <p class="text-muted">جارٍ تحميل الأجهزة…</p> }
    @for (device of devices.value()?.data ?? []; track device.id) {
      <article class="card p-3 mb-2"><strong>{{ deviceName(device) || device.imei }}</strong><div class="text-muted">IMEI: {{ device.imei }}</div></article>
    }
  `,
})
export class GpsDevicesComponent {
  private readonly api = inject(GpsDevicesApi);
  protected readonly devices = createResource(() => GPS_DEVICES_QUERY_DEFAULTS, (q) => this.api.list(q));
  protected readonly deviceName = deviceName;
}
