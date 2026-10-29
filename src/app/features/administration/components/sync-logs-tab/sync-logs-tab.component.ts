import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { ChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe, NumberPipe } from '@shared/pipes/format.pipes';
import { IntegrationsApi } from '../../data-access/integrations.api';
import {
  SYNC_LOGS_QUERY_DEFAULTS,
  SyncLogDto,
  SyncLogsQuery,
  formatDuration,
  syncDurationMs,
  syncError,
  syncItems,
  syncProvider,
  syncSuccess,
  syncTime,
} from '../../models/integration.models';

type Row = TemplateRef<{ $implicit: SyncLogDto }>;

/** GPS provider calls (`GET /gps/sync-logs`) — newest first, filters in the URL. */
@Component({
  selector: 'app-sync-logs-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    SearchInputComponent,
    ChipComponent,
    IconComponent,
    CairoDatePipe,
    NumberPipe,
  ],
  template: `
    <div class="filters" role="search">
      <app-search-input
        [value]="f().integration"
        (valueChange)="filters.patch({ integration: $event })"
        placeholder="التكامل / المزود"
      />
      <app-search-input
        [value]="f().operation"
        (valueChange)="filters.patch({ operation: $event })"
        placeholder="العملية"
      />
      <select
        class="form-select"
        aria-label="النتيجة"
        [value]="f().success"
        (change)="selectSuccess($event)"
      >
        <option value="">كل النتائج</option>
        <option value="true">ناجحة</option>
        <option value="false">فاشلة</option>
      </select>
      <span class="filters__spacer"></span>
      @if (hasFilters()) {
        <button type="button" class="btn btn-ghost btn-sm" (click)="filters.reset()">
          <app-icon name="close" [size]="14" />
          مسح الفلاتر
        </button>
      }
      <button type="button" class="btn btn-sm" [disabled]="logs.loading()" (click)="logs.reload()">
        <app-icon name="refresh" [size]="14" />
        تحديث
      </button>
    </div>

    @if (logs.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="logs.reload()">إعادة المحاولة</button>
      </div>
    }

    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="logs.loading()"
      emptyIcon="refresh"
      [emptyTitle]="hasFilters() ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات مزامنة بعد'"
    />

    @if (page(); as p) {
      <app-pagination
        [pageIndex]="f().pageIndex"
        [pageSize]="f().pageSize"
        [count]="p.count"
        [totalPages]="p.totalPages"
        [disabled]="logs.loading()"
        (pageChange)="filters.patch({ pageIndex: $event })"
        (pageSizeChange)="filters.patch({ pageSize: $event })"
      />
    }

    <ng-template #timeTpl let-l>
      @if (time(l); as t) {
        <span [title]="t | cairoDate">{{ t | cairoDate: 'relative' }}</span>
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #providerTpl let-l>
      <span class="ltr">{{ provider(l) || '—' }}</span>
    </ng-template>
    <ng-template #operationTpl let-l>
      <span class="ltr">{{ l.operation || '—' }}</span>
    </ng-template>
    <ng-template #resultTpl let-l>
      @switch (success(l)) {
        @case (true) {
          <app-chip tone="success" icon="check-circle" [small]="true">ناجحة</app-chip>
        }
        @case (false) {
          <app-chip tone="danger" icon="close" [small]="true">فاشلة</app-chip>
        }
        @default {
          <span class="muted">—</span>
        }
      }
    </ng-template>
    <ng-template #durationTpl let-l>
      <span class="sl-num">{{ duration(l) }}</span>
    </ng-template>
    <ng-template #itemsTpl let-l>
      @if (items(l) !== null) {
        {{ items(l) | num }}
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #messageTpl let-l>
      @if (error(l); as e) {
        <span class="sl-msg sl-msg--error" [title]="e">{{ e }}</span>
      } @else if (l.message) {
        <span class="sl-msg muted" [title]="l.message">{{ l.message }}</span>
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
  `,
  styles: `
    .sl-num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .sl-msg {
      display: inline-block;
      max-width: 22rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
      unicode-bidi: plaintext;
    }
    .sl-msg--error {
      color: var(--re);
    }
  `,
})
export class SyncLogsTabComponent {
  private readonly api = inject(IntegrationsApi);

  protected readonly filters = injectUrlState<SyncLogsQuery>(SYNC_LOGS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly logs = createResource(
    () => this.f(),
    (q) => this.api.syncLogs(q),
  );
  protected readonly rows = computed(() => this.logs.value()?.data ?? []);
  protected readonly page = computed(() => this.logs.value());
  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return !!(f.integration || f.operation || f.success);
  });

  protected readonly time = syncTime;
  protected readonly provider = syncProvider;
  protected readonly success = syncSuccess;
  protected readonly items = syncItems;
  protected readonly error = syncError;
  protected readonly duration = (l: SyncLogDto) => formatDuration(syncDurationMs(l));

  private readonly timeTpl = viewChild<Row>('timeTpl');
  private readonly providerTpl = viewChild<Row>('providerTpl');
  private readonly operationTpl = viewChild<Row>('operationTpl');
  private readonly resultTpl = viewChild<Row>('resultTpl');
  private readonly durationTpl = viewChild<Row>('durationTpl');
  private readonly itemsTpl = viewChild<Row>('itemsTpl');
  private readonly messageTpl = viewChild<Row>('messageTpl');

  protected readonly columns = computed<TableColumn<SyncLogDto>[]>(() => [
    { key: 'startedAtUtc', label: 'الوقت', cellTemplate: this.timeTpl() },
    { key: 'integration', label: 'التكامل', cellTemplate: this.providerTpl() },
    { key: 'operation', label: 'العملية', cellTemplate: this.operationTpl() },
    { key: 'success', label: 'النتيجة', cellTemplate: this.resultTpl() },
    { key: 'durationMs', label: 'المدة', cellTemplate: this.durationTpl() },
    { key: 'itemsProcessed', label: 'العناصر', cellTemplate: this.itemsTpl() },
    { key: 'message', label: 'الرسالة / الخطأ', align: 'start', cellTemplate: this.messageTpl() },
  ]);

  protected selectSuccess(event: Event): void {
    this.filters.patch({
      success: (event.target as HTMLSelectElement).value as SyncLogsQuery['success'],
    });
  }
}
