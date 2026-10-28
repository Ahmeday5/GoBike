import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { firstError } from '@shared/validators/form-validation.util';

@Component({
  selector: 'app-form-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as msg) {
      <div class="invalid-feedback d-block app-form-error">{{ msg }}</div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .app-form-error {
        font-size: 0.6563rem;
        color: var(--re);
        margin-top: 0.1875rem;
        line-height: 1.4;
      }
    `,
  ],
})
export class FormErrorComponent {
  readonly control = input.required<AbstractControl | null | undefined>();
  readonly label = input.required<string>();
  /**
   * Set to `true` when you want the error to appear regardless of touched/
   * dirty (e.g. on submit attempt). The parent typically calls
   * `form.markAllAsTouched()` instead, so default is fine.
   */
  readonly forceShow = input<boolean>(false);

  /** Bumped on every status/value/touched/dirty change of the bound control. */
  private readonly tick = signal(0);

  constructor() {
    effect(
      (onCleanup) => {
        const ctrl = this.control();
        if (!ctrl) return;

        const sub = ctrl.events.subscribe(() => {
          this.tick.update((v) => v + 1);
        });
        onCleanup(() => sub.unsubscribe());
      },
      { allowSignalWrites: true },
    );
  }

  protected readonly message = computed(() => {
    this.tick(); // reactive dependency — forces re-evaluation on control events
    const ctrl = this.control();
    if (!ctrl) return null;
    if (this.forceShow()) {
      return firstError(ctrl, this.label()) ?? null;
    }
    return firstError(ctrl, this.label());
  });
}
