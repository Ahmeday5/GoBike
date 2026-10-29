import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Dashboard (staff) password rules. ASP.NET Identity enforces them server
 * side as well; these mirror its defaults with a slightly longer minimum, so
 * anything that passes here is accepted by the API.
 */
const RULES = [
  { id: 'length', label: '8 أحرف على الأقل', test: (v: string) => v.length >= 8 },
  { id: 'upper', label: 'حرف إنجليزي كبير (A-Z)', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'حرف إنجليزي صغير (a-z)', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', label: 'رقم واحد على الأقل', test: (v: string) => /\d/.test(v) },
  { id: 'symbol', label: 'رمز مثل ! @ # $', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

/** Validator: required + every rule. */
export function staffPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '');
  if (!v) return { required: true };
  return RULES.every((r) => r.test(v))
    ? null
    : { passwordRules: 'كلمة المرور لا تستوفي الشروط الموضحة' };
}

/** Live checklist under a staff password field. */
@Component({
  selector: 'app-staff-password-rules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <ul class="spr" aria-live="polite">
      @for (r of checks(); track r.id) {
        <li class="spr__item" [class.spr__item--ok]="r.ok">
          <app-icon [name]="r.ok ? 'check-circle' : 'minus-circle'" [size]="13" />
          {{ r.label }}
        </li>
      }
    </ul>
  `,
  styles: `
    .spr {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.875rem;
      margin: 0.375rem 0 0;
      padding: 0;
      list-style: none;
    }
    .spr__item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: var(--fs-xs);
      color: var(--txt3);
      transition: color var(--dur-2) var(--ease-out);
      app-icon {
        transition: transform var(--dur-3) var(--ease-spring);
      }
    }
    .spr__item--ok {
      color: var(--gr);
      app-icon {
        transform: scale(1.15);
      }
    }
  `,
})
export class StaffPasswordRulesComponent {
  readonly value = input<string | null | undefined>('');

  protected readonly checks = computed(() => {
    const v = this.value() ?? '';
    return RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(v) }));
  });
}
