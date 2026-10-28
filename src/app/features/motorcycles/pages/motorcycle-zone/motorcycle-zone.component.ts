import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { createResource } from '@core/data/resource';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { APP_ROUTES } from '@core/constants/app-routes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';

@Component({
  selector: 'app-motorcycle-zone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, JsonPipe],
  template: `
    <app-page-header title="نطاق الموتوسيكل" [backLink]="backLink" />
    @if (zone.loading()) { <p class="text-muted">جارٍ تحميل النطاق…</p> }
    @else if (zone.value()) { <article class="card p-3"><pre class="mb-0">{{ zone.value() | json }}</pre></article> }
    @else { <p class="text-muted">لم يتم تحديد نطاق لهذا الموتوسيكل.</p> }
  `,
})
export class MotorcycleZoneComponent {
  readonly id = input.required<string>();
  private readonly api = inject(MotorcyclesApi);
  protected readonly backLink = APP_ROUTES.motorcycles;
  protected readonly zone = createResource(() => this.id(), (id) => this.api.zone(id));
}
