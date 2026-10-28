import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { UsersApi } from '../../data-access/users.api';
import { USERS_QUERY_DEFAULTS } from '../../models/user.models';

@Component({
  selector: 'app-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="المستخدمون" subtitle="حسابات موظفي لوحة التحكم" />
    @if (users.loading()) { <p class="text-muted">جارٍ تحميل المستخدمين…</p> }
    @for (user of users.value()?.data ?? []; track user.id) {
      <article class="card p-3 mb-2"><strong>{{ user.fullName }}</strong><div class="text-muted">{{ user.email }}</div></article>
    }
  `,
})
export class UsersComponent {
  private readonly api = inject(UsersApi);
  protected readonly users = createResource(() => USERS_QUERY_DEFAULTS, (q) => this.api.list(q));
}
