import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { CairoDatePipe, MoneyPipe } from '@shared/pipes/format.pipes';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';

/**
 * Account tab → statement (`GET /drivers/{id}/statement`), the printable
 * part of the account. A plain table rather than `app-data-table` so print
 * CSS controls wrapping and nothing is clipped by a scroll container.
 */
@Component({
  selector: 'app-driver-statement',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, CairoDatePipe, MoneyPipe],
  template: `
    <section class="panel st" style="--i: 1">
      <header class="panel__head">
        <h2 class="panel__title"><app-icon name="file" [size]="18" />كشف الحساب</h2>
        <button
          type="button"
          class="btn btn-sm no-print"
          [disabled]="!entries().length"
          (click)="print()"
        >
          <app-icon name="print" [size]="14" />
          طباعة الكشف
        </button>
      </header>

      <div class="st__print-head">
        <strong>كشف حساب السائق{{ driverName() ? ': ' + driverName() : '' }}</strong>
        <span>تاريخ الطباعة: {{ printedAt() | cairoDate }}</span>
      </div>

      @if (statement.error(); as err) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
          role="alert"
        >
          <span>{{ err.message }}</span>
          <button type="button" class="btn btn-sm" (click)="statement.reload()">
            إعادة المحاولة
          </button>
        </div>
      } @else if (statement.initialLoading()) {
        <div class="st__skeleton" aria-busy="true">
          @for (s of [0, 1, 2, 3]; track s) {
            <span class="skeleton"></span>
          }
        </div>
      } @else if (!entries().length) {
        <app-empty-state icon="file" title="لا توجد حركات على حساب هذا السائق" />
      } @else {
        <div class="tw st__wrap" [class.st__wrap--busy]="statement.loading()">
          <table class="table st__table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>البيان</th>
                <th class="st__num">مدين (عليه)</th>
                <th class="st__num">دائن (له)</th>
                <th class="st__num">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              @for (e of entries(); track $index) {
                <tr>
                  <td class="st__date">{{ e.atUtc | cairoDate }}</td>
                  <td>
                    <span class="st__kind" [class.st__kind--pay]="e.type === 'Payment'">
                      <app-icon [name]="e.type === 'Payment' ? 'cash' : 'file'" [size]="13" />
                    </span>
                    {{ e.description || '—' }}
                    @if (e.reference) {
                      <span class="muted ltr st__ref">{{ e.reference }}</span>
                    }
                  </td>
                  <td class="st__num">
                    @if (e.debit) {
                      <span class="amount amount--debt">{{ e.debit | money }}</span>
                    }
                  </td>
                  <td class="st__num">
                    @if (e.credit) {
                      <span class="amount amount--credit">{{ e.credit | money }}</span>
                    }
                  </td>
                  <td class="st__num">
                    <span
                      class="amount"
                      [class.amount--debt]="e.runningBalance > 0"
                      [class.amount--credit]="e.runningBalance < 0"
                      >{{ e.runningBalance | money }}</span
                    >
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th colspan="2">الإجمالي</th>
                <th class="st__num">
                  <span class="amount">{{ totals().debit | money }}</span>
                </th>
                <th class="st__num">
                  <span class="amount">{{ totals().credit | money }}</span>
                </th>
                <th class="st__num">
                  <span
                    class="amount"
                    [class.amount--debt]="totals().balance > 0"
                    [class.amount--credit]="totals().balance < 0"
                    >{{ totals().balance | money }}</span
                  >
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="form-hint">الرصيد الموجب مديونية على السائق، والسالب رصيد دائن له.</p>
      }
    </section>
  `,
  styles: `
    .st__print-head {
      display: none;
    }
    .st__skeleton {
      display: grid;
      gap: 0.5rem;
      .skeleton {
        height: 2rem;
      }
    }
    .st__wrap {
      transition: opacity var(--dur-2);
    }
    .st__wrap--busy {
      opacity: 0.6;
    }
    .st__table {
      th,
      td {
        vertical-align: middle;
      }
      tfoot th {
        border-top: 2px solid var(--brd2);
      }
    }
    .st__num {
      text-align: end;
    }
    .st__date {
      color: var(--txt2);
    }
    .st__kind {
      display: inline-grid;
      place-items: center;
      width: 1.375rem;
      height: 1.375rem;
      margin-inline-end: 0.375rem;
      border-radius: var(--r-sm);
      background: var(--re-l);
      color: var(--re);
      vertical-align: middle;
    }
    .st__kind--pay {
      background: var(--gr-l);
      color: var(--gr);
    }
    .st__ref {
      margin-inline-start: 0.375rem;
      font-size: var(--fs-xs);
    }

    @media print {
      .st {
        border: none;
        box-shadow: none;
        padding: 0;
        animation: none;
      }
      .st__print-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.75rem;
        font-size: 12pt;
      }
      .st__wrap {
        overflow: visible;
        border: none;
        box-shadow: none;
        opacity: 1;
        table {
          white-space: normal;
        }
      }
      .st__table {
        font-size: 10pt;
        tr {
          break-inside: avoid;
        }
      }
      .amount--debt,
      .amount--credit,
      .st__kind {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `,
})
export class DriverStatementComponent {
  private readonly api = inject(DriverLedgerApi);

  readonly driverId = input.required<string>();
  readonly driverName = input<string | null>(null);
  /** Bumped by the parent after any ledger action → reload. */
  readonly version = input(0);

  protected readonly statement = createResource(
    () => ({ id: this.driverId(), v: this.version() }),
    ({ id }) => this.api.statement(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly entries = computed(() => this.statement.value()?.entries ?? []);

  protected readonly totals = computed(() => {
    const list = this.entries();
    const debit = list.reduce((s, e) => s + (e.debit ?? 0), 0);
    const credit = list.reduce((s, e) => s + (e.credit ?? 0), 0);
    const last = list[list.length - 1];
    return { debit, credit, balance: last ? last.runningBalance : debit - credit };
  });

  /** Stamped on the printout; refreshed right before printing. */
  protected readonly printedAt = signal(new Date());

  protected print(): void {
    this.printedAt.set(new Date());
    // Let the new timestamp render before the print snapshot is taken.
    setTimeout(() => window.print());
  }
}
