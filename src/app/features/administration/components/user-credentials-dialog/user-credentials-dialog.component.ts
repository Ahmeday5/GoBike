import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { writeClipboard } from '../../utils/clipboard';

export interface StaffCredentials {
  fullName: string;
  email: string;
  password: string;
  /** true → account just created; false → password reset. */
  isNew: boolean;
}

type CopyTarget = 'email' | 'password' | 'all';

/**
 * Shows a staff member's dashboard login ONCE (after creating the user or
 * resetting the password). The API never returns it again, so the dialog
 * closes only on an explicit acknowledgement — not Esc or the backdrop.
 */
@Component({
  selector: 'app-user-credentials-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  template: `
    <app-modal
      [open]="open()"
      [title]="credentials()?.isNew ? 'بيانات دخول المستخدم الجديد' : 'كلمة المرور الجديدة'"
      size="md"
      [closeOnEsc]="false"
      [closeOnBackdrop]="false"
      [showClose]="false"
    >
      @if (credentials(); as c) {
        <div class="uc">
          <div class="uc__hero anim-scale-in">
            <span class="uc__badge"><app-icon name="key" [size]="26" /></span>
            <p class="uc__lead">
              @if (c.isNew) {
                حساب <strong>{{ c.fullName }}</strong> جاهز للدخول إلى لوحة التحكم.
              } @else {
                تم تعيين كلمة مرور جديدة لـ <strong>{{ c.fullName }}</strong
                >.
              }
            </p>
          </div>

          <div class="uc__field anim-fade-up" style="--i: 1">
            <span class="uc__label">البريد الإلكتروني (اسم المستخدم)</span>
            <div class="uc__row">
              <code class="uc__value ltr">{{ c.email }}</code>
              <button
                type="button"
                class="uc__copy"
                [class.uc__copy--done]="copied() === 'email'"
                (click)="copy('email')"
                aria-label="نسخ البريد الإلكتروني"
              >
                <app-icon [name]="copied() === 'email' ? 'check' : 'copy'" [size]="16" />
                <span>{{ copied() === 'email' ? 'تم النسخ' : 'نسخ' }}</span>
              </button>
            </div>
          </div>

          <div class="uc__field anim-fade-up" style="--i: 2">
            <span class="uc__label">كلمة المرور</span>
            <div class="uc__row">
              <code class="uc__value uc__value--pw ltr">{{ c.password }}</code>
              <button
                type="button"
                class="uc__copy"
                [class.uc__copy--done]="copied() === 'password'"
                (click)="copy('password')"
                aria-label="نسخ كلمة المرور"
              >
                <app-icon [name]="copied() === 'password' ? 'check' : 'copy'" [size]="16" />
                <span>{{ copied() === 'password' ? 'تم النسخ' : 'نسخ' }}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            class="btn uc__all anim-fade-up"
            style="--i: 3"
            (click)="copy('all')"
          >
            <app-icon [name]="copied() === 'all' ? 'check' : 'copy'" [size]="16" />
            {{ copied() === 'all' ? 'تم النسخ' : 'نسخ بيانات الدخول كاملة' }}
          </button>

          <div class="uc__warn anim-fade-up" style="--i: 4" role="alert">
            <app-icon name="alert" [size]="18" />
            <div>
              <strong>لن تظهر كلمة المرور مرة أخرى.</strong>
              انسخها وسلّمها للمستخدم بطريقة آمنة. إن فُقدت، أعد تعيينها من صفحة المستخدمين.
            </div>
          </div>
        </div>
      }

      <div class="modal-actions">
        <button type="button" class="btn btn-brand" (click)="done()">
          <app-icon name="check" [size]="16" />
          تم، احتفظت بها
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .uc {
      display: grid;
      gap: 0.875rem;
      font-size: var(--fs-base);
    }
    .uc__hero {
      display: grid;
      justify-items: center;
      gap: 0.375rem;
      text-align: center;
    }
    .uc__badge {
      width: 3.5rem;
      height: 3.5rem;
      display: grid;
      place-items: center;
      border-radius: 1.125rem;
      color: var(--gr);
      background: var(--gr-l);
      animation: pop-in var(--dur-4) var(--ease-spring) both;
    }
    .uc__lead {
      margin: 0;
      font-size: var(--fs-md);
    }
    .uc__field {
      display: grid;
      gap: 0.3rem;
    }
    .uc__label {
      font-size: var(--fs-xs);
      font-weight: 600;
      color: var(--txt2);
    }
    .uc__row {
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
      padding: 0.375rem;
      border: 1px solid var(--brd2);
      border-radius: var(--rl);
      background: var(--bg3);
    }
    .uc__value {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0.375rem 0.75rem;
      overflow-x: auto;
      font-family: ui-monospace, 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
      font-size: var(--fs-md);
      font-weight: 700;
      color: var(--txt);
      background: none;
      user-select: all;
      white-space: nowrap;
    }
    .uc__value--pw {
      font-size: var(--fs-2xl);
      letter-spacing: 0.06em;
      color: var(--primary);
    }
    .uc__copy {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      flex-shrink: 0;
      padding: 0 0.875rem;
      border: 1px solid var(--brd);
      border-radius: var(--r);
      background: var(--bg2);
      color: var(--txt2);
      font: inherit;
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition:
        color var(--dur-2),
        background var(--dur-2),
        border-color var(--dur-2);
      &:hover {
        color: var(--primary);
        border-color: var(--primary);
      }
    }
    .uc__copy--done {
      color: var(--gr);
      border-color: var(--gr);
      background: var(--gr-l);
    }
    .uc__all {
      justify-self: stretch;
    }
    .uc__warn {
      display: flex;
      gap: 0.625rem;
      align-items: flex-start;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--am);
      border-radius: var(--rl);
      background: var(--am-l);
      color: var(--am);
      font-size: var(--fs-sm);
      line-height: 1.6;
      app-icon {
        flex-shrink: 0;
        margin-block-start: 0.125rem;
      }
      strong {
        display: block;
      }
    }
  `,
})
export class UserCredentialsDialogComponent {
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly credentials = input<StaffCredentials | null>(null);
  readonly closed = output<void>();

  protected readonly copied = signal<CopyTarget | null>(null);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly message = computed(() => {
    const c = this.credentials();
    if (!c) return '';
    return [
      `مرحبًا ${c.fullName}،`,
      'بيانات دخولك إلى لوحة تحكم GoBiky:',
      `البريد الإلكتروني: ${c.email}`,
      `كلمة المرور: ${c.password}`,
      'احتفظ بها ولا تشاركها مع أحد.',
    ].join('\n');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyTimer) clearTimeout(this.copyTimer);
    });
  }

  protected async copy(target: CopyTarget): Promise<void> {
    const c = this.credentials();
    if (!c) return;
    const text = target === 'email' ? c.email : target === 'password' ? c.password : this.message();
    if (!(await writeClipboard(text))) {
      this.toast.warning('تعذّر النسخ تلقائيًا، حدِّد النص وانسخه يدويًا');
      return;
    }
    this.copied.set(target);
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(null), 1800);
  }

  protected done(): void {
    this.copied.set(null);
    this.closed.emit();
  }
}
