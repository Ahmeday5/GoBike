import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IntegrationsApi } from '../../data-access/integrations.api';

@Component({
  selector: 'app-integrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, JsonPipe],
  template: `
    <app-page-header title="حالة التكاملات" subtitle="صحة مزود GPS وسجل المزامنة والإشعارات" />
    @if (health.loading()) { <p class="text-muted">جارٍ تحميل حالة التكاملات…</p> }
    @else { <article class="card p-3"><pre class="mb-0">{{ health.value() ?? {} | json }}</pre></article> }
  `,
})
export class IntegrationsComponent {
  private readonly api = inject(IntegrationsApi);
  protected readonly health = createResource(() => true, () => this.api.gpsHealth());
}
