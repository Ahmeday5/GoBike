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
import { DriverCredentials } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { IconComponent } from '@shared/components/icon/icon.component';

type CopyTarget = 'phone' | 'password' | 'all';

/**
 * Egyptian mobile → WhatsApp international digits: `01xxxxxxxxx` → `201xxxxxxxxx`.
 * Numbers already in international form (20… / 0020…) are kept as is.
 */
export function toWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `2${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `20${digits}`;
  return digits;
}

/**
 * Shows a driver's app login ONCE (after creating the account or setting a
 * password). The backend never returns the password again, so the dialog
 * can't be dismissed by Esc/backdrop — only by an explicit acknowledgement.
 */
@Component({
  selector: 'app-credentials-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, IconComponent],
  templateUrl: './credentials-dialog.component.html',
  styleUrl: './credentials-dialog.component.scss',
})
export class CredentialsDialogComponent {
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly credentials = input<DriverCredentials | null>(null);
  readonly driverName = input<string | null | undefined>('');
  /** Heading tweak: new account vs. a reset password. */
  readonly title = input('بيانات دخول السائق للتطبيق');
  readonly closed = output<void>();

  protected readonly copied = signal<CopyTarget | null>(null);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyTimer) clearTimeout(this.copyTimer);
    });
  }

  private readonly message = computed(() => {
    const c = this.credentials();
    if (!c) return '';
    const name = this.driverName();
    return [
      name ? `مرحبًا ${name}،` : 'مرحبًا،',
      'بيانات دخولك إلى تطبيق GoBiky:',
      `رقم الهاتف: ${c.loginPhone}`,
      `كلمة المرور: ${c.password}`,
      'احتفظ بها ولا تشاركها مع أحد.',
    ].join('\n');
  });

  protected readonly whatsAppUrl = computed(() => {
    const c = this.credentials();
    if (!c) return '';
    return `https://wa.me/${toWhatsAppNumber(c.loginPhone)}?text=${encodeURIComponent(this.message())}`;
  });

  protected async copy(target: CopyTarget): Promise<void> {
    const c = this.credentials();
    if (!c) return;
    const text =
      target === 'phone' ? c.loginPhone : target === 'password' ? c.password : this.message();
    const ok = await writeClipboard(text);
    if (!ok) {
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

/** Async Clipboard API when available (secure contexts), legacy execCommand otherwise. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied / insecure context → fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
