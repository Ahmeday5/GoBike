import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { APP_ROUTES } from '@core/constants/app-routes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';

@Component({
  selector: 'app-motorcycle-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, JsonPipe],
  template: `
    <app-page-header title="تفاصيل الموتوسيكل" [backLink]="listLink" />
    @if (motorcycle.loading()) { <p class="text-muted">جارٍ تحميل بيانات الموتوسيكل…</p> }
    @else { <article class="card p-3"><pre class="mb-0">{{ motorcycle.value() ?? {} | json }}</pre></article> }
  `,
})
export class MotorcycleDetailComponent {
  readonly id = input.required<string>();
  private readonly api = inject(MotorcyclesApi);
  protected readonly listLink = APP_ROUTES.motorcycles;
  protected readonly motorcycle = createResource(() => this.id(), (id) => this.api.get(id));
}
