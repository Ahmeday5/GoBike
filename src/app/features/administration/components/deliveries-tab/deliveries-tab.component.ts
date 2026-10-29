import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DELIVERY_STATUS, enumOptions } from '@core/constants/enums';
import { LookupService } from '@core/data/lookup.service';
import { createResource } from '@core/data/resource';
import { injectUrlState } from '@core/routing/url-state';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe, NumberPipe } from '@shared/pipes/format.pipes';
import { IntegrationsApi } from '../../data-access/integrations.api';
import {
  DELIVERIES_QUERY_DEFAULTS,
  DELIVERY_CHANNEL_LABELS,
  DeliveriesQuery,
  NotificationDeliveryDto,
  deliveryAttempts,
  deliveryError,
  deliveryRecipient,
  deliveryTime,
  deliveryTitle,
} from '../../models/integration.models';

type Row = TemplateRef<{ $implicit: NotificationDeliveryDto }>;

/** Notification delivery attempts (`GET /notifications/deliveries`). */
@Component({
  selector: 'app-deliveries-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTableComponent,
    PaginationComponent,
    EnumChipComponent,
    IconComponent,
    CairoDatePipe,
    NumberPipe,
  ],
  template: `
    <div class="filters" role="search">
      <select
        class="form-select"
        aria-label="الحالة"
        [value]="f().status"
        (change)="select('status', $event)"
      >
        <option value="">كل الحالات</option>
        @for (o of statusOptions; track o.value) {
          <option [value]="o.value">{{ o.label }}</option>
        }
      </select>
      <select
        class="form-select"
        aria-label="المستلم"
        [value]="f().userId"
        (change)="select('userId', $event)"
      >
        <option value="">كل المستلمين</option>
        @for (u of staff(); track u.id) {
          <option [value]="u.id">{{ u.fullName }}</option>
        }
      </select>
      <span class="filters__spacer"></span>
      @if (hasFilters()) {
        <button type="button" class="btn btn-ghost btn-sm" (click)="filters.reset()">
          <app-icon name="close" [size]="14" />
          مسح الفلاتر
        </button>
      }
      <button
        type="button"
        class="btn btn-sm"
        [disabled]="deliveries.loading()"
        (click)="deliveries.reload()"
      >
        <app-icon name="refresh" [size]="14" />
        تحديث
      </button>
    </div>

    @if (deliveries.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="deliveries.reload()">
          إعادة المحاولة
        </button>
      </div>
    }

    <app-data-table
      [columns]="columns()"
      [data]="rows()"
      [loading]="deliveries.loading()"
      emptyIcon="send"
      [emptyTitle]="hasFilters() ? 'لا توجد نتائج مطابقة' : 'لا توجد محاولات إرسال بعد'"
    />

    @if (page(); as p) {
      <app-pagination
        [pageIndex]="f().pageIndex"
        [pageSize]="f().pageSize"
        [count]="p.count"
        [totalPages]="p.totalPages"
        [disabled]="deliveries.loading()"
        (pageChange)="filters.patch({ pageIndex: $event })"
        (pageSizeChange)="filters.patch({ pageSize: $event })"
      />
    }

    <ng-template #timeTpl let-d>
      @if (time(d); as t) {
        <span [title]="t | cairoDate">{{ t | cairoDate: 'relative' }}</span>
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #titleTpl let-d>
      <span class="dl-text">{{ title(d) || '—' }}</span>
    </ng-template>
    <ng-template #recipientTpl let-d>
      {{ recipient(d) || '—' }}
    </ng-template>
    <ng-template #channelTpl let-d>
      @if (d.channel) {
        {{ channelLabel(d.channel) }}
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #statusTpl let-d>
      <app-enum-chip [map]="STATUS" [value]="d.status" [small]="true" />
    </ng-template>
    <ng-template #attemptsTpl let-d>
      @if (attempts(d) !== null) {
        {{ attempts(d) | num }}
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
    <ng-template #errorTpl let-d>
      @if (error(d); as e) {
        <span class="dl-text dl-text--error" [title]="e">{{ e }}</span>
      } @else {
        <span class="muted">—</span>
      }
    </ng-template>
  `,
  styles: `
    .dl-text {
      display: inline-block;
      max-width: 18rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
      unicode-bidi: plaintext;
    }
    .dl-text--error {
      color: var(--re);
    }
  `,
})
export class DeliveriesTabComponent {
  private readonly api = inject(IntegrationsApi);

  protected readonly STATUS = DELIVERY_STATUS;
  protected readonly statusOptions = enumOptions(DELIVERY_STATUS);
  protected readonly staff = toSignal(inject(LookupService).staff(), { initialValue: [] });

  protected readonly filters = injectUrlState<DeliveriesQuery>(DELIVERIES_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly deliveries = createResource(
    () => this.f(),
    (q) => this.api.deliveries(q),
  );
  protected readonly rows = computed(() => this.deliveries.value()?.data ?? []);
  protected readonly page = computed(() => this.deliveries.value());
  protected readonly hasFilters = computed(() => !!(this.f().status || this.f().userId));

  protected readonly time = deliveryTime;
  protected readonly title = deliveryTitle;
  protected readonly recipient = deliveryRecipient;
  protected readonly error = deliveryError;
  protected readonly attempts = deliveryAttempts;
  protected readonly channelLabel = (c: string) => DELIVERY_CHANNEL_LABELS[c] ?? c;

  private readonly timeTpl = viewChild<Row>('timeTpl');
  private readonly titleTpl = viewChild<Row>('titleTpl');
  private readonly recipientTpl = viewChild<Row>('recipientTpl');
  private readonly channelTpl = viewChild<Row>('channelTpl');
  private readonly statusTpl = viewChild<Row>('statusTpl');
  private readonly attemptsTpl = viewChild<Row>('attemptsTpl');
  private readonly errorTpl = viewChild<Row>('errorTpl');

  protected readonly columns = computed<TableColumn<NotificationDeliveryDto>[]>(() => [
    { key: 'createdAtUtc', label: 'الوقت', cellTemplate: this.timeTpl() },
    { key: 'title', label: 'الإشعار', align: 'start', cellTemplate: this.titleTpl() },
    { key: 'recipient', label: 'المستلم', cellTemplate: this.recipientTpl() },
    { key: 'channel', label: 'القناة', cellTemplate: this.channelTpl() },
    { key: 'status', label: 'الحالة', cellTemplate: this.statusTpl() },
    { key: 'attempts', label: 'المحاولات', cellTemplate: this.attemptsTpl() },
    { key: 'error', label: 'الخطأ', align: 'start', cellTemplate: this.errorTpl() },
  ]);

  protected select(field: 'status' | 'userId', event: Event): void {
    this.filters.patch({
      [field]: (event.target as HTMLSelectElement).value,
    } as Partial<DeliveriesQuery>);
  }
}
