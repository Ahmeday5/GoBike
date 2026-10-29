import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MOTORCYCLE_STATUS } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { StatusHistoryDto } from '../../models/motorcycle-overview.models';

type Row = TemplateRef<{ $implicit: StatusHistoryDto }>;

/** Motorcycle page → status history (`GET /motorcycles/{id}/status-history`), newest first. */
@Component({
  selector: 'app-motorcycle-status-history-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, EnumChipComponent, CairoDatePipe],
  template: `
    @if (history.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="history.reload()">إعادة المحاولة</button>
      </div>
    }
    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="history.loading()"
      emptyIcon="clock"
      emptyTitle="لا يوجد سجل حالات"
    />

    <ng-template #changeTpl let-h>
      <span class="sh-change">
        @if (h.fromStatus) {
          <app-enum-chip [map]="STATUS" [value]="h.fromStatus" [small]="true" />
          <span class="muted" aria-label="إلى">←</span>
        }
        <app-enum-chip [map]="STATUS" [value]="h.toStatus ?? h.status" [small]="true" />
      </span>
    </ng-template>
    <ng-template #atTpl let-h>{{ h.changedAtUtc ?? h.createdAtUtc | cairoDate }}</ng-template>
    <ng-template #byTpl let-h>{{ h.changedByName || h.changedByUserName || 'النظام' }}</ng-template>
  `,
  styles: `
    .sh-change {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem;
    }
  `,
})
export class MotorcycleStatusHistoryTabComponent {
  private readonly api = inject(MotorcyclesApi);

  readonly motorcycleId = input.required<string>();

  protected readonly STATUS = MOTORCYCLE_STATUS;
  protected readonly history = createResource(
    () => this.motorcycleId(),
    (id) => this.api.statusHistory(id),
  );
  protected readonly rows = computed(() =>
    [...(this.history.value() ?? [])].sort((a, b) =>
      (b.changedAtUtc ?? b.createdAtUtc ?? '').localeCompare(
        a.changedAtUtc ?? a.createdAtUtc ?? '',
      ),
    ),
  );

  private readonly changeTpl = viewChild<Row>('changeTpl');
  private readonly atTpl = viewChild<Row>('atTpl');
  private readonly byTpl = viewChild<Row>('byTpl');

  protected readonly columns = computed<TableColumn<StatusHistoryDto>[]>(() => [
    { key: 'toStatus', label: 'التغيير', cellTemplate: this.changeTpl() },
    { key: 'reason', label: 'السبب' },
    { key: 'changedAtUtc', label: 'الوقت', cellTemplate: this.atTpl() },
    { key: 'changedByName', label: 'بواسطة', cellTemplate: this.byTpl() },
  ]);
}
