import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';

/** Driver app password rules (backend-enforced too). Empty is allowed: the server generates one. */
const RULES = [
  { id: 'length', label: '6 أحرف على الأقل', test: (v: string) => v.length >= 6 },
  { id: 'digit', label: 'رقم واحد على الأقل', test: (v: string) => /\d/.test(v) },
  {
    id: 'lower',
    label: 'حرف إنجليزي صغير واحد على الأقل (a-z)',
    test: (v: string) => /[a-z]/.test(v),
  },
] as const;

/** Validator: passes when empty (auto-generate) or when every rule holds. */
export function driverPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '');
  if (!v) return null;
  return RULES.every((r) => r.test(v))
    ? null
    : { passwordRules: 'كلمة المرور لا تستوفي الشروط الموضحة' };
}

/** Live checklist under a password field. */
@Component({
  selector: 'app-password-rules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (value()) {
      <ul class="pr" aria-live="polite">
        @for (r of checks(); track r.id) {
          <li class="pr__item" [class.pr__item--ok]="r.ok">
            <app-icon [name]="r.ok ? 'check-circle' : 'minus-circle'" [size]="13" />
            {{ r.label }}
          </li>
        }
      </ul>
    } @else {
      <p class="form-hint pr__auto">
        <app-icon name="key" [size]="13" />
        اتركها فارغة وسيُنشئ النظام كلمة مرور قوية (8 أحرف) تلقائيًا.
      </p>
    }
  `,
  styles: `
    .pr {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.875rem;
      margin: 0.375rem 0 0;
      padding: 0;
      list-style: none;
    }
    .pr__item {
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
    .pr__item--ok {
      color: var(--gr);

      app-icon {
        transform: scale(1.15);
      }
    }
    .pr__auto {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
  `,
})
export class PasswordRulesComponent {
  readonly value = input<string | null | undefined>('');

  protected readonly checks = computed(() => {
    const v = this.value() ?? '';
    return RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(v) }));
  });
}
