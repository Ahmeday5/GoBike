import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Tone } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { IntegrationsApi } from '../../data-access/integrations.api';
import { GpsHealthDto } from '../../models/integration.models';
import { KvViewComponent } from '../kv-view/kv-view.component';

/** Arabic labels for the `GET /gps/health` keys we can anticipate; others are humanized. */
const HEALTH_LABELS: Record<string, string> = {
  status: 'الحالة',
  provider: 'المزود',
  providerName: 'المزود',
  isHealthy: 'سليم',
  healthy: 'سليم',
  isEnabled: 'مفعّل',
  enabled: 'مفعّل',
  isConfigured: 'مُعدّ',
  lastSyncAtUtc: 'آخر مزامنة',
  lastSuccessfulSyncAtUtc: 'آخر مزامنة ناجحة',
  lastSuccessAtUtc: 'آخر نجاح',
  lastFailureAtUtc: 'آخر فشل',
  lastErrorAtUtc: 'آخر خطأ',
  lastError: 'آخر خطأ',
  lastErrorMessage: 'آخر رسالة خطأ',
  consecutiveFailures: 'إخفاقات متتالية',
  failureCount: 'عدد الإخفاقات',
  failedSyncs: 'مزامنات فاشلة',
  successfulSyncs: 'مزامنات ناجحة',
  totalDevices: 'إجمالي الأجهزة',
  deviceCount: 'الأجهزة',
  onlineDevices: 'أجهزة متصلة',
  offlineDevices: 'أجهزة غير متصلة',
  staleDevices: 'أجهزة بلا إشارة حديثة',
  linkedDevices: 'أجهزة مربوطة',
  unlinkedDevices: 'أجهزة غير مربوطة',
  syncIntervalSeconds: 'فترة المزامنة (ثانية)',
  pollIntervalSeconds: 'فترة الاستعلام (ثانية)',
  averageDurationMs: 'متوسط مدة الاستدعاء (مللي ثانية)',
  isOutage: 'عطل لدى المزود',
  outageSinceUtc: 'بداية العطل',
  message: 'رسالة',
  checkedAtUtc: 'وقت الفحص',
};

const GOOD = ['healthy', 'ok', 'online', 'up', 'connected', 'running', 'success'];
const BAD = ['unhealthy', 'down', 'offline', 'error', 'failed', 'outage', 'disconnected'];

/** Overall verdict from whatever the health payload contains. */
function verdict(h: GpsHealthDto): { tone: Tone; icon: string; label: string } | null {
  const flag = h['isHealthy'] ?? h['healthy'];
  if (typeof flag === 'boolean') {
    return flag
      ? { tone: 'success', icon: 'check-circle', label: 'مزود التتبع يعمل بشكل طبيعي' }
      : { tone: 'danger', icon: 'alert', label: 'توجد مشكلة في الاتصال بمزود التتبع' };
  }
  if (h['isOutage'] === true)
    return { tone: 'danger', icon: 'cloud-off', label: 'عطل لدى مزود التتبع' };
  const status = String(h['status'] ?? '').toLowerCase();
  if (GOOD.includes(status))
    return { tone: 'success', icon: 'check-circle', label: 'مزود التتبع يعمل بشكل طبيعي' };
  if (BAD.includes(status))
    return { tone: 'danger', icon: 'alert', label: 'توجد مشكلة في الاتصال بمزود التتبع' };
  if (status === 'degraded' || status === 'warning') {
    return { tone: 'warning', icon: 'alert', label: 'أداء مزود التتبع متراجع' };
  }
  return null;
}

/** GPS provider health (`GET /gps/health`) — shape undocumented, rendered defensively. */
@Component({
  selector: 'app-gps-health-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipComponent, IconComponent, CairoDatePipe, KvViewComponent],
  template: `
    <section class="panel">
      <div class="panel__head">
        <h2 class="panel__title">
          <app-icon name="pulse" [size]="18" />
          صحة مزود التتبع
        </h2>
        <button
          type="button"
          class="btn btn-sm"
          [disabled]="health.loading()"
          (click)="health.reload()"
        >
          <app-icon name="refresh" [size]="14" [class.gh-spin]="health.loading()" />
          تحديث
        </button>
      </div>

      @if (health.initialLoading()) {
        <div class="gh-skel" aria-busy="true">
          <span class="skeleton" style="height: 2.75rem"></span>
          <div class="gh-skel__tiles">
            @for (i of [1, 2, 3, 4]; track i) {
              <span class="skeleton" style="height: 4.25rem"></span>
            }
          </div>
        </div>
      } @else if (health.error()) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ health.error()?.message }}</span>
          <button type="button" class="btn btn-sm" (click)="health.reload()">إعادة المحاولة</button>
        </div>
      } @else {
        @if (status(); as s) {
          <div class="gh-verdict" [attr.data-tone]="s.tone">
            <app-chip [tone]="s.tone" [icon]="s.icon">{{ s.label }}</app-chip>
            <span class="muted gh-checked">آخر فحص {{ checkedAt() | cairoDate: 'time' }}</span>
          </div>
        }
        <app-kv-view [data]="health.value()" [labels]="labels" />
      }
    </section>
  `,
  styles: `
    .gh-verdict {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--brd);
      border-radius: var(--rl);
      background: var(--bg);
    }
    .gh-checked {
      font-size: var(--fs-xs);
    }
    .gh-skel {
      display: grid;
      gap: 0.75rem;
    }
    .gh-skel__tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
      gap: 0.625rem;
    }
    .gh-spin {
      display: inline-flex;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class GpsHealthPanelComponent {
  private readonly api = inject(IntegrationsApi);

  protected readonly labels = HEALTH_LABELS;
  protected readonly health = createResource(
    () => true,
    () => this.api.gpsHealth(),
  );
  protected readonly status = computed(() => {
    const h = this.health.value();
    return h ? verdict(h) : null;
  });
  /** Client clock of the last successful load (the payload may not carry one). */
  protected readonly checkedAt = computed(() => (this.health.value() ? new Date() : null));
}
