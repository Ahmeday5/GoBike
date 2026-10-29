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
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';
import { MotorcyclesApi } from '../../data-access/motorcycles.api';
import { TransferDto } from '../../models/motorcycle-overview.models';

type Row = TemplateRef<{ $implicit: TransferDto }>;

/** Motorcycle page → office transfers (`GET /motorcycles/{id}/transfers`), newest first. */
@Component({
  selector: 'app-motorcycle-transfers-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, CairoDatePipe],
  template: `
    @if (transfers.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="transfers.reload()">
          إعادة المحاولة
        </button>
      </div>
    }
    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="transfers.loading()"
      emptyIcon="building"
      emptyTitle="لم يُنقل هذا الموتوسيكل بين المكاتب"
    />

    <ng-template #officeTpl let-t>
      {{ t.fromOfficeName || '—' }} <span class="muted">←</span>
      <strong>{{ t.toOfficeName || '—' }}</strong>
    </ng-template>
    <ng-template #supTpl let-t>
      {{ t.fromSupervisorName || '—' }} <span class="muted">←</span> {{ t.toSupervisorName || '—' }}
    </ng-template>
    <ng-template #atTpl let-t>{{ t.transferredAtUtc ?? t.createdAtUtc | cairoDate }}</ng-template>
  `,
})
export class MotorcycleTransfersTabComponent {
  private readonly api = inject(MotorcyclesApi);

  readonly motorcycleId = input.required<string>();

  protected readonly transfers = createResource(
    () => this.motorcycleId(),
    (id) => this.api.transfers(id),
  );
  protected readonly rows = computed(() =>
    [...(this.transfers.value() ?? [])].sort((a, b) =>
      (b.transferredAtUtc ?? b.createdAtUtc ?? '').localeCompare(
        a.transferredAtUtc ?? a.createdAtUtc ?? '',
      ),
    ),
  );

  private readonly officeTpl = viewChild<Row>('officeTpl');
  private readonly supTpl = viewChild<Row>('supTpl');
  private readonly atTpl = viewChild<Row>('atTpl');

  protected readonly columns = computed<TableColumn<TransferDto>[]>(() => [
    { key: 'toOfficeName', label: 'المكتب', cellTemplate: this.officeTpl() },
    { key: 'toSupervisorName', label: 'المشرف', cellTemplate: this.supTpl() },
    { key: 'reason', label: 'السبب' },
    { key: 'transferredAtUtc', label: 'الوقت', cellTemplate: this.atTpl() },
    { key: 'transferredByName', label: 'بواسطة' },
  ]);
}
