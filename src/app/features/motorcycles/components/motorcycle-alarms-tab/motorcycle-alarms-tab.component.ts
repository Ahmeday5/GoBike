import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { CairoDatePipe, NumberPipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { GpsAlarmDto } from '../../models/motorcycle-overview.models';
import { GpsWindowQuery, defaultGpsWindow, resolveGpsWindow } from '../../utils/gps-window';
import { GpsWindowFilterComponent } from '../gps-window-filter/gps-window-filter.component';

type Row = TemplateRef<{ $implicit: GpsAlarmDto }>;

/**
 * Motorcycle page → alarms tab (`GET /gps/motorcycles/{id}/alarms`). Shares
 * the `?from=&to=` window with the route tab; page in `?alarmsPage=`.
 * Alarm types come raw from the GPS provider, so they're shown as sent.
 */
@Component({
  selector: 'app-motorcycle-alarms-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    ChipComponent,
    CairoDatePipe,
    NumberPipe,
    GpsWindowFilterComponent,
  ],
  template: `
    <app-gps-window-filter [window]="win()" (changed)="setWindow($event)" />

    @if (alarms.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="alarms.reload()">إعادة المحاولة</button>
      </div>
    }

    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="alarms.loading()"
      emptyIcon="bell"
      emptyTitle="لا توجد إنذارات في هذه الفترة"
    />
    @if (alarms.value(); as p) {
      <app-pagination
        [pageIndex]="url.state().alarmsPage"
        [pageSize]="pageSize"
        [count]="p.count"
        [totalPages]="p.totalPages"
        [showPageSize]="false"
        [disabled]="alarms.loading()"
        (pageChange)="url.patch({ alarmsPage: $event })"
      />
    }

    <ng-template #typeTpl let-a>
      <app-chip tone="warning" icon="bell" [small]="true">{{
        a.alarmType || a.type || '—'
      }}</app-chip>
    </ng-template>
    <ng-template #msgTpl let-a>{{ a.message || a.description || '—' }}</ng-template>
    <ng-template #atTpl let-a>{{
      a.alarmAtUtc ?? a.atUtc ?? a.occurredAtUtc | cairoDate
    }}</ng-template>
    <ng-template #speedTpl let-a>
      @if ((a.speedKmh ?? null) !== null) {
        <span class="ltr">{{ a.speedKmh | num }}</span> كم/س
      } @else {
        —
      }
    </ng-template>
    <ng-template #posTpl let-a>
      @if ((a.latitude ?? null) !== null && (a.longitude ?? null) !== null) {
        <a
          class="link-btn ltr"
          target="_blank"
          rel="noopener"
          [href]="mapLink(a.latitude, a.longitude)"
        >
          {{ a.latitude.toFixed(5) }}, {{ a.longitude.toFixed(5) }}
        </a>
      } @else {
        —
      }
    </ng-template>
  `,
})
export class MotorcycleAlarmsTabComponent {
  private readonly api = inject(MotorcyclesApi);

  readonly motorcycleId = input.required<string>();

  protected readonly pageSize = 20;
  /** One state object: window + page must be written in a single navigation. */
  protected readonly url = injectUrlState({ from: '', to: '', alarmsPage: 1 });
  private readonly fallback = defaultGpsWindow();
  protected readonly win = computed(() => resolveGpsWindow(this.url.state(), this.fallback));

  protected readonly alarms = createResource(
    () => {
      const w = this.win();
      return w.error || !w.fromUtc || !w.toUtc
        ? null
        : {
            id: this.motorcycleId(),
            fromUtc: w.fromUtc,
            toUtc: w.toUtc,
            pageIndex: this.url.state().alarmsPage,
          };
    },
    ({ id, ...q }) => this.api.alarms(id, { ...q, pageSize: this.pageSize }),
  );
  protected readonly rows = computed(() => this.alarms.value()?.data ?? []);

  private readonly typeTpl = viewChild<Row>('typeTpl');
  private readonly msgTpl = viewChild<Row>('msgTpl');
  private readonly atTpl = viewChild<Row>('atTpl');
  private readonly speedTpl = viewChild<Row>('speedTpl');
  private readonly posTpl = viewChild<Row>('posTpl');

  protected readonly columns = computed<TableColumn<GpsAlarmDto>[]>(() => [
    { key: 'alarmType', label: 'النوع', cellTemplate: this.typeTpl() },
    { key: 'message', label: 'الوصف', cellTemplate: this.msgTpl() },
    { key: 'atUtc', label: 'الوقت', cellTemplate: this.atTpl() },
    { key: 'speedKmh', label: 'السرعة', cellTemplate: this.speedTpl() },
    { key: 'latitude', label: 'الموقع', cellTemplate: this.posTpl() },
  ]);

  protected setWindow(change: Partial<GpsWindowQuery>): void {
    this.url.patch({ ...change, alarmsPage: 1 });
  }

  protected mapLink(lat: number, lng: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }
}
