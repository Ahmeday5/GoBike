import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_ROUTES } from '@core/constants/app-routes';
import { OIL_CHANGE_STATUS } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe, KmPipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { DriversApi } from '../../data-access/drivers.api';

/** Driver page → oil-change videos tab (`GET /oil-changes?driverId=`), newest first. */
@Component({
  selector: 'app-driver-oil-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PaginationComponent,
    EnumChipComponent,
    EmptyStateComponent,
    IconComponent,
    CairoDatePipe,
    KmPipe,
    MoneyPipe,
  ],
  templateUrl: './driver-oil-tab.component.html',
  styleUrl: './driver-oil-tab.component.scss',
})
export class DriverOilTabComponent {
  private readonly api = inject(DriversApi);

  readonly driverId = input.required<string>();

  protected readonly STATUS = OIL_CHANGE_STATUS;
  protected readonly pageSize = 12;
  protected readonly skeletons = [0, 1, 2, 3];
  protected readonly url = injectUrlState({ oilPage: 1 });
  protected readonly state = this.url.state;

  protected readonly submissions = createResource(
    () => ({ id: this.driverId(), page: this.state().oilPage }),
    ({ id, page }) => this.api.oilChanges(id, page, this.pageSize),
  );
  protected readonly rows = computed(() => this.submissions.value()?.data ?? []);

  protected link(id: string): string {
    return APP_ROUTES.oilChange(id);
  }
}
