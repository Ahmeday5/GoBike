import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { OfficesApi } from '../../data-access/offices.api';
import { OFFICES_QUERY_DEFAULTS } from '../../models/office.models';

@Component({
  selector: 'app-offices',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="المكاتب" subtitle="المكاتب والفروع التابعة للنظام" />
    @if (offices.loading()) { <p class="text-muted">جارٍ تحميل المكاتب…</p> }
    @for (office of offices.value()?.data ?? []; track office.id) {
      <article class="card p-3 mb-2"><strong>{{ office.name }}</strong><div class="text-muted">{{ office.city || '—' }}</div></article>
    }
  `,
})
export class OfficesComponent {
  private readonly api = inject(OfficesApi);
  protected readonly offices = createResource(() => OFFICES_QUERY_DEFAULTS, (q) => this.api.list(q));
}
