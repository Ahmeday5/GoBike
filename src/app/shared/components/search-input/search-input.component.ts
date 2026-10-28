import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

const DEBOUNCE_MS = 350;

/**
 * Debounced search box. Bind `value` from URL state and handle `valueChange`
 * by patching it — the URL (and the request) only updates once typing pauses.
 *
 *   <app-search-input [value]="f.search" (valueChange)="filters.patch({ search: $event })"
 *     placeholder="ابحث برقم اللوحة…" />
 */
@Component({
  selector: 'app-search-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <label class="si">
      <app-icon class="si__icon" name="search" [size]="16" />
      <input
        type="search"
        class="form-control si__input"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [value]="draft()"
        (input)="onInput($event)"
        (keydown.enter)="flush()"
        (keydown.escape)="clear()"
      />
      @if (draft()) {
        <button type="button" class="si__clear" (click)="clear()" aria-label="مسح البحث">
          <app-icon name="close" [size]="14" />
        </button>
      }
    </label>
  `,
  styles: `
    :host {
      display: block;
      min-width: 14rem;
      flex: 1 1 16rem;
      max-width: 24rem;
    }
    .si {
      position: relative;
      display: block;
      margin: 0;
    }
    .si__icon {
      position: absolute;
      inset-inline-start: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--txt3);
      pointer-events: none;
    }
    .si__input {
      padding-inline: 2.375rem 2.25rem;
      &::-webkit-search-cancel-button {
        display: none;
      }
    }
    .si__clear {
      position: absolute;
      inset-inline-end: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      width: 1.5rem;
      height: 1.5rem;
      display: grid;
      place-items: center;
      border: none;
      border-radius: var(--r-full);
      background: var(--bg3);
      color: var(--txt2);
      cursor: pointer;
      animation: pop-in var(--dur-3) var(--ease-spring);
    }
  `,
})
export class SearchInputComponent {
  readonly value = input<string>('');
  readonly placeholder = input('بحث…');
  readonly valueChange = output<string>();

  protected readonly draft = signal('');
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // External changes (back/forward, "reset filters") win over the draft.
    effect(() => {
      const v = this.value();
      untracked(() => this.draft.set(v));
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    this.cancel();
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  protected flush(): void {
    this.cancel();
    const next = this.draft().trim();
    if (next !== this.value()) this.valueChange.emit(next);
  }

  protected clear(): void {
    this.draft.set('');
    this.flush();
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
