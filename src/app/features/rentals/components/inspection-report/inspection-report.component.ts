import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import { APP_ROUTES } from '@core/constants/app-routes';
import { FAULT_SEVERITY, INSPECTION_RESULT } from '@core/constants/enums';
import { InspectionDto } from '@core/models/domain.models';
import { EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CairoDatePipe } from '@shared/pipes/format.pipes';

/**
 * Body of a return inspection: result, what it caused (repair opened or bike
 * available again), the fault list with severities, summary and notes. Used
 * by the rental page and the inspection page.
 */
@Component({
  selector: 'app-inspection-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EnumChipComponent, IconComponent, CairoDatePipe],
  template: `
    @let i = inspection();
    <dl class="kv">
      <div>
        <dt>النتيجة</dt>
        <dd><app-enum-chip [map]="RESULT" [value]="i.result" [small]="true" /></dd>
      </div>
      <div>
        <dt>وقت الاستلام</dt>
        <dd>{{ i.returnedAtUtc ?? i.inspectedAtUtc | cairoDate }}</dd>
      </div>
      <div>
        <dt>وقت الفحص</dt>
        <dd>{{ i.inspectedAtUtc | cairoDate }}</dd>
      </div>
      <div>
        <dt>الفاحص</dt>
        <dd>{{ i.inspectedByName || '—' }}</dd>
      </div>
    </dl>

    @if (i.result === 'HasFaults') {
      <div class="ir-callout ir-callout--faults" role="note">
        <app-icon name="wrench" [size]="18" />
        <div class="ir-callout__body">
          <strong>تم فتح سجل إصلاح لهذه الموتوسيكل</strong>
          <span>تبقى في الحالة الحمراء حتى يُنهي الفني الإصلاح ويعتمده المشرف.</span>
        </div>
        @if (repairLink(); as link) {
          <a class="btn btn-sm btn-re" [routerLink]="link">
            <app-icon name="wrench" [size]="14" />
            فتح سجل الإصلاح
          </a>
        }
      </div>
    } @else {
      <div class="ir-callout" role="note">
        <app-icon name="check-circle" [size]="18" />
        <div class="ir-callout__body">
          <strong>استُلمت سليمة</strong>
          <span>عادت الموتوسيكل خضراء ومتاحة للتأجير.</span>
        </div>
      </div>
    }

    @if (i.faultSummary) {
      <h3 class="ir-sub">ملخص الأعطال</h3>
      <p class="ir-text">{{ i.faultSummary }}</p>
    }

    @if (faults().length) {
      <h3 class="ir-sub">الأعطال ({{ faults().length }})</h3>
      <ol class="ir-faults">
        @for (f of faults(); track $index) {
          <li class="ir-fault">
            <span class="ir-fault__n">{{ $index + 1 }}</span>
            <span class="ir-fault__text">{{ f.description }}</span>
            <app-enum-chip [map]="SEVERITY" [value]="f.severity" [small]="true" />
          </li>
        }
      </ol>
    } @else if (i.result === 'HasFaults' && !i.faultSummary) {
      <p class="muted ir-text">لم تُسجَّل تفاصيل الأعطال.</p>
    }

    @if (i.notes) {
      <h3 class="ir-sub">ملاحظات</h3>
      <p class="ir-text">{{ i.notes }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .ir-callout {
      --tone: var(--gr);
      --tone-l: var(--gr-l);
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.625rem 0.75rem;
      margin-top: 1rem;
      padding: 0.75rem 0.875rem;
      border-radius: var(--r);
      border-inline-start: 0.25rem solid var(--tone);
      background: var(--tone-l);

      > app-icon {
        color: var(--tone);
      }
    }
    .ir-callout--faults {
      --tone: var(--re);
      --tone-l: var(--re-l);
    }
    .ir-callout__body {
      display: grid;
      gap: 0.125rem;
      flex: 1;
      min-width: 12rem;
      font-size: var(--fs-sm);

      strong {
        color: var(--tone);
      }
      span {
        color: var(--txt2);
      }
    }
    .ir-sub {
      margin: 1.125rem 0 0.5rem;
      font-size: var(--fs-sm);
      font-weight: 700;
      color: var(--txt2);
    }
    .ir-text {
      margin: 0;
      font-size: var(--fs-sm);
      line-height: 1.8;
      white-space: pre-line;
    }
    .ir-faults {
      display: grid;
      gap: 0.375rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ir-fault {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--brd);
      border-radius: var(--r);
      background: var(--bg2);
      font-size: var(--fs-sm);
    }
    .ir-fault__n {
      width: 1.5rem;
      height: 1.5rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--bg3);
      color: var(--txt2);
      font-size: var(--fs-xs);
      font-weight: 700;
    }
    .ir-fault__text {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }
  `,
})
export class InspectionReportComponent {
  private readonly auth = inject(AuthService);

  readonly inspection = input.required<InspectionDto>();

  protected readonly RESULT = INSPECTION_RESULT;
  protected readonly SEVERITY = FAULT_SEVERITY;

  protected readonly faults = computed(() => this.inspection().faults ?? []);
  protected readonly repairLink = computed(() => {
    const id = this.inspection().maintenanceRecordId;
    return id && this.auth.hasPermission(PERMISSIONS.Maintenance.Read)
      ? APP_ROUTES.maintenanceRecord(id)
      : null;
  });
}
