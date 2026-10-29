import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ALERT_RECIPIENT,
  AlertRecipient,
  MAINTENANCE_ALERT_LEVEL,
  MaintenanceAlertLevel,
} from '@core/constants/enums';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe, MoneyPipe, NumberPipe } from '@shared/pipes/format.pipes';
import { MaintenancePolicyDto, POLICY_DEFAULTS, parseRecipients } from '../../models/policy.models';
import { ThresholdBarComponent } from '../threshold-bar/threshold-bar.component';

interface LevelRow {
  level: MaintenanceAlertLevel;
  km: number | null;
  recipients: AlertRecipient[];
}

/** Read-only summary of one oil-change policy, with edit / make-default actions. */
@Component({
  selector: 'app-policy-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    CairoDatePipe,
    MoneyPipe,
    NumberPipe,
    ThresholdBarComponent,
  ],
  template: `
    @let p = policy();
    <article
      class="panel pc"
      [class.pc--default]="p.isDefault"
      [class.pc--off]="p.isActive === false"
      [style.--i]="index()"
    >
      <header class="pc__head">
        <div class="pc__titles">
          <h2 class="pc__name">{{ p.name }}</h2>
          @if (p.description) {
            <p class="pc__desc">{{ p.description }}</p>
          }
        </div>
        <div class="pc__chips">
          @if (p.isDefault) {
            <app-chip tone="info" icon="check-circle">الافتراضية</app-chip>
          }
          @if (p.isActive === false) {
            <app-chip tone="neutral" icon="pause">غير مفعّلة</app-chip>
          } @else {
            <app-chip tone="success" icon="check-circle">مفعّلة</app-chip>
          }
        </div>
      </header>

      <app-threshold-bar
        class="pc__bar"
        [firstWarningKm]="p.firstWarningKm ?? defaults.firstWarningKm"
        [secondWarningKm]="p.secondWarningKm ?? defaults.secondWarningKm"
        [criticalKm]="p.criticalKm ?? defaults.criticalKm"
        [maxKm]="p.maxKm ?? defaults.maxKm"
      />

      <dl class="kv pc__kv">
        <div>
          <dt>الغرامة لكل كم بعد {{ p.maxKm ?? defaults.maxKm | num }} كم</dt>
          <dd class="amount amount--debt">{{ p.overdueFinePerKm | money }}</dd>
        </div>
        <div>
          <dt>تكرار تنبيه الحد الحرج</dt>
          <dd>
            @if (p.criticalReminderIntervalHours) {
              كل {{ p.criticalReminderIntervalHours | num }} ساعة
            } @else {
              <span class="muted">—</span>
            }
          </dd>
        </div>
        <div>
          <dt>عند تخطي أكثر من حد دفعة واحدة</dt>
          <dd>
            @if (p.notifyOnlyHighestWhenSkipping) {
              تنبيه المستوى الأعلى فقط
            } @else {
              كل التنبيهات المتخطاة
            }
          </dd>
        </div>
        @if ((p.motorcycleCount ?? null) !== null) {
          <div>
            <dt>الموتوسيكلات المرتبطة</dt>
            <dd>{{ p.motorcycleCount | num }}</dd>
          </div>
        }
      </dl>

      <div class="pc__recipients">
        <h3 class="pc__sub">من يصله كل تنبيه</h3>
        @for (row of levels(); track row.level) {
          <div class="pc__level">
            <span class="pc__level-name">
              <app-enum-chip [map]="LEVEL" [value]="row.level" [small]="true" />
              @if (row.km !== null) {
                <span class="muted ltr">{{ row.km | num }} كم</span>
              }
            </span>
            <span class="pc__level-who">
              @for (r of row.recipients; track r) {
                <app-chip [small]="true">{{ RECIPIENT[r].label }}</app-chip>
              } @empty {
                <span class="muted">لا أحد</span>
              }
            </span>
          </div>
        }
      </div>

      <footer class="pc__foot">
        @if (p.updatedAtUtc) {
          <span class="muted pc__updated"
            >آخر تعديل {{ p.updatedAtUtc | cairoDate: 'relative' }}</span
          >
        }
        <span class="pc__spacer"></span>
        @if (!p.isDefault && p.isActive !== false) {
          <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="makeDefault.emit()">
            <app-icon name="check-circle" [size]="14" />
            اجعلها الافتراضية
          </button>
        }
        <button
          type="button"
          class="btn btn-sm btn-brand"
          [disabled]="busy()"
          (click)="edit.emit()"
        >
          <app-icon name="edit" [size]="14" />
          تعديل
        </button>
      </footer>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .pc {
      display: grid;
      gap: 1rem;
      height: 100%;
      margin: 0;
      transition:
        border-color var(--dur-3),
        box-shadow var(--dur-3);
    }
    .pc--default {
      border-color: var(--primary);
      box-shadow:
        0 0 0 3px var(--primary-ring),
        var(--shadow);
    }
    .pc--off {
      opacity: 0.75;
    }
    .pc__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .pc__name {
      margin: 0;
      font-size: var(--fs-md);
      font-weight: 700;
    }
    .pc__desc {
      margin: 0.25rem 0 0;
      font-size: var(--fs-sm);
      color: var(--txt2);
    }
    .pc__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .pc__kv {
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    }
    .pc__sub {
      margin: 0 0 0.5rem;
      font-size: var(--fs-xs);
      font-weight: 600;
      color: var(--txt3);
    }
    .pc__recipients {
      display: grid;
      gap: 0.375rem;
    }
    .pc__level {
      display: grid;
      grid-template-columns: 9.5rem 1fr;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem;
      border-radius: var(--r);
      background: var(--bg);
      @media (max-width: 575.98px) {
        grid-template-columns: 1fr;
      }
    }
    .pc__level-name {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: var(--fs-xs);
    }
    .pc__level-who {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      font-size: var(--fs-xs);
    }
    .pc__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--brd2);
    }
    .pc__updated {
      font-size: var(--fs-xs);
    }
    .pc__spacer {
      flex: 1;
    }
  `,
})
export class PolicyCardComponent {
  readonly policy = input.required<MaintenancePolicyDto>();
  readonly index = input(0);
  readonly busy = input(false);
  readonly edit = output<void>();
  readonly makeDefault = output<void>();

  protected readonly LEVEL = MAINTENANCE_ALERT_LEVEL;
  protected readonly RECIPIENT = ALERT_RECIPIENT;
  protected readonly defaults = POLICY_DEFAULTS;

  protected readonly levels = computed<LevelRow[]>(() => {
    const p = this.policy();
    return [
      {
        level: 'FirstWarning',
        km: p.firstWarningKm ?? null,
        recipients: parseRecipients(p.firstWarningRecipients),
      },
      {
        level: 'SecondWarning',
        km: p.secondWarningKm ?? null,
        recipients: parseRecipients(p.secondWarningRecipients),
      },
      {
        level: 'Critical',
        km: p.criticalKm ?? null,
        recipients: parseRecipients(p.criticalRecipients),
      },
      { level: 'Overdue', km: p.maxKm ?? null, recipients: parseRecipients(p.overdueRecipients) },
    ];
  });
}
