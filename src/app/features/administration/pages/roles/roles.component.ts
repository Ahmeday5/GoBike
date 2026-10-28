import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { RolesApi } from '../../data-access/roles.api';

@Component({
  selector: 'app-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="الأدوار والصلاحيات" subtitle="إدارة أدوار المستخدمين وصلاحياتهم" />
    @if (roles.loading()) { <p class="text-muted">جارٍ تحميل الأدوار…</p> }
    @for (role of roles.value() ?? []; track role.name) {
      <article class="card p-3 mb-2"><strong>{{ role.name }}</strong><div class="text-muted">{{ role.permissions.length }} صلاحية</div></article>
    }
  `,
})
export class RolesComponent {
  private readonly api = inject(RolesApi);
  protected readonly roles = createResource(() => true, () => this.api.list());
}
