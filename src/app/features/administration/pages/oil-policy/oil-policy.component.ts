import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { createResource } from '@core/data/resource';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { formatMoney } from '@core/utils/format.util';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { PoliciesApi } from '../../data-access/policies.api';
import { MaintenancePolicyDto, policyToRequest } from '../../models/policy.models';
import { PolicyCardComponent } from '../../components/policy-card/policy-card.component';
import { PolicyFormDialogComponent } from '../../components/policy-form-dialog/policy-form-dialog.component';

/**
 * Settings → Oil-change policy: thresholds (400/450/500/600 by default), the
 * per-km overdue fine and who gets each alert. Exactly one policy is the
 * default; it applies to every motorcycle without a specific policy.
 */
@Component({
  selector: 'app-oil-policy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
    PolicyCardComponent,
    PolicyFormDialogComponent,
  ],
  template: `
    <app-page-header
      title="سياسة تغيير الزيت"
      subtitle="حدود عداد الزيت، غرامة التأخير، ومن يصله كل تنبيه"
    >
      <button type="button" class="btn btn-brand" (click)="openCreate()">
        <app-icon name="plus" [size]="16" />
        سياسة جديدة
      </button>
    </app-page-header>

    <div class="op-hint anim-fade-up">
      <app-icon name="info" [size]="18" />
      <p>
        يُحتسب العداد بالكيلومترات منذ آخر تغيير زيت <strong>مقبول</strong>. تصل التنبيهات عند كل
        حد، وكل كم بعد الحد الأقصى يُغرَّم بالسعر المحدد ويصبح مديونية على السائق عند قبول فيديو
        التغيير. توجد سياسة <strong>افتراضية واحدة</strong> تُطبَّق على كل موتوسيكل غير مرتبط بسياسة
        أخرى؛ جعل سياسة افتراضية يلغي ذلك عن السابقة تلقائيًا.
      </p>
    </div>

    @if (policies.error(); as err) {
      <div
        class="alert alert-danger d-flex justify-content-between align-items-center"
        role="alert"
      >
        <span>{{ err.message }}</span>
        <button type="button" class="btn btn-sm" (click)="policies.reload()">إعادة المحاولة</button>
      </div>
    }

    @if (policies.initialLoading()) {
      <div class="op-grid" aria-busy="true">
        @for (i of [1, 2]; track i) {
          <div class="panel op-skel">
            <span class="skeleton" style="width: 40%; height: 1.25rem"></span>
            <span class="skeleton" style="width: 100%; height: 0.75rem"></span>
            <span class="skeleton" style="width: 70%; height: 0.875rem"></span>
            <span class="skeleton" style="width: 100%; height: 6rem"></span>
          </div>
        }
      </div>
    } @else if (!list().length && !policies.error()) {
      <div class="panel">
        <app-empty-state
          icon="droplet"
          title="لا توجد سياسات بعد"
          text="أنشئ السياسة الافتراضية لتبدأ تنبيهات تغيير الزيت وغرامات التأخير."
        >
          <button type="button" class="btn btn-brand" (click)="openCreate()">
            <app-icon name="plus" [size]="16" />
            إنشاء السياسة الافتراضية
          </button>
        </app-empty-state>
      </div>
    } @else {
      <div class="op-grid" [class.op-grid--busy]="policies.loading()">
        @for (p of list(); track p.id; let i = $index) {
          <app-policy-card
            [policy]="p"
            [index]="i"
            [busy]="busyId() === p.id"
            (edit)="openEdit(p)"
            (makeDefault)="makeDefault(p)"
          />
        }
      </div>
    }

    <app-policy-form-dialog
      [open]="formOpen()"
      [policy]="editing()"
      [currentDefault]="currentDefault()"
      (closed)="closeForm()"
      (saved)="onSaved()"
    />
  `,
  styles: `
    .op-hint {
      display: flex;
      gap: 0.625rem;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--brd);
      border-radius: var(--rl);
      background: var(--bl-l);
      color: var(--bl);
      font-size: var(--fs-sm);
      line-height: 1.7;
      app-icon {
        flex-shrink: 0;
        margin-block-start: 0.2rem;
      }
      p {
        margin: 0;
      }
    }
    .op-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
      gap: 1rem;
      transition: opacity var(--dur-2);
    }
    .op-grid--busy {
      opacity: 0.7;
    }
    .op-skel {
      display: grid;
      gap: 0.75rem;
      margin: 0;
    }
  `,
})
export class OilPolicyComponent {
  private readonly api = inject(PoliciesApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly policies = createResource(
    () => true,
    () => this.api.list(),
  );
  /** Default first, then active, then by name. */
  protected readonly list = computed(() =>
    [...(this.policies.value() ?? [])].sort(
      (a, b) =>
        Number(!!b.isDefault) - Number(!!a.isDefault) ||
        Number(b.isActive !== false) - Number(a.isActive !== false) ||
        a.name.localeCompare(b.name, 'ar'),
    ),
  );
  protected readonly currentDefault = computed(() => this.list().find((p) => p.isDefault) ?? null);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<MaintenancePolicyDto | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(p: MaintenancePolicyDto): void {
    this.editing.set(p);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected onSaved(): void {
    this.closeForm();
    this.policies.reload();
  }

  protected async makeDefault(p: MaintenancePolicyDto): Promise<void> {
    const current = this.currentDefault();
    const oldFine = Number(current?.overdueFinePerKm ?? 0);
    const newFine = Number(p.overdueFinePerKm ?? 0);
    const fineLine =
      current && Math.abs(oldFine - newFine) >= 0.005
        ? ` سعر الغرامة لكل كم سيتغير من ${formatMoney(oldFine)} إلى ${formatMoney(newFine)}.`
        : '';
    const ok = await this.dialog.confirm({
      title: 'تعيين السياسة الافتراضية؟',
      message:
        `ستصبح «${p.name}» السياسة الافتراضية لكل موتوسيكل غير مرتبط بسياسة محددة` +
        (current ? `، ولن تبقى «${current.name}» افتراضية.` : '.') +
        fineLine,
      type: 'warning',
      confirmText: 'تعيين كافتراضية',
    });
    if (!ok) return;
    this.busyId.set(p.id);
    this.api.save(p.id, policyToRequest(p, { isDefault: true, isActive: true })).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('تم تعيين السياسة الافتراضية');
        this.policies.reload();
      },
      error: () => this.busyId.set(null),
    });
  }
}
