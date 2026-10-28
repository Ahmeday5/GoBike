import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PoliciesApi } from '../../data-access/policies.api';

@Component({
  selector: 'app-oil-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="سياسة تغيير الزيت" subtitle="إدارة سياسات الصيانة وتنبيهات الزيت" />
    @if (policies.loading()) { <p class="text-muted">جارٍ تحميل السياسات…</p> }
    @for (policy of policies.value() ?? []; track policy.id) {
      <article class="card p-3 mb-2"><strong>{{ policy.name }}</strong><div class="text-muted">{{ policy.description || 'لا يوجد وصف' }}</div></article>
    }
  `,
})
export class OilPolicyComponent {
  private readonly api = inject(PoliciesApi);
  protected readonly policies = createResource(() => true, () => this.api.list());
}
