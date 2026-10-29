import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { createResource } from '@core/data/resource';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { MoneyPipe } from '@shared/pipes/format.pipes';
import { DriverLedgerApi } from '../../data-access/driver-ledger.api';
import { DriverStatementComponent } from './driver-statement.component';
import { DriverChargesComponent } from './driver-charges.component';
import { DriverPaymentsComponent } from './driver-payments.component';
import { RecordPaymentDialogComponent } from './record-payment-dialog.component';
import { ManualChargeDialogComponent } from './manual-charge-dialog.component';

/**
 * 5.10 — Driver account (debts & payments): balance, printable statement,
 * charges and payments. Every ledger action changes all four views (a payment
 * settles charges and moves the running balance), so any action bumps one
 * `version` that each part folds into its request params.
 */
@Component({
  selector: 'app-driver-account-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    HasPermissionDirective,
    MoneyPipe,
    DriverStatementComponent,
    DriverChargesComponent,
    DriverPaymentsComponent,
    RecordPaymentDialogComponent,
    ManualChargeDialogComponent,
  ],
  templateUrl: './driver-account-tab.component.html',
  styleUrl: './driver-account-tab.component.scss',
})
export class DriverAccountTabComponent {
  private readonly api = inject(DriverLedgerApi);

  readonly driverId = input.required<string>();
  readonly driverName = input<string | null>(null);

  protected readonly P = PERMISSIONS;
  protected readonly version = signal(0);

  protected readonly balanceRes = createResource(
    () => ({ id: this.driverId(), v: this.version() }),
    ({ id }) => this.api.balance(id),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );
  protected readonly balance = computed(() => this.balanceRes.value() ?? null);
  protected readonly outstanding = computed(() => this.balance()?.outstanding ?? 0);

  protected readonly paymentOpen = signal(false);
  protected readonly chargeOpen = signal(false);

  /** Refresh balance, statement, charges and payments after any ledger change. */
  protected refresh(): void {
    this.version.update((v) => v + 1);
  }

  protected onChargeAdded(): void {
    this.chargeOpen.set(false);
    this.refresh();
  }
}
