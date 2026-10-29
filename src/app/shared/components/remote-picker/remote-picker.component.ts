import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface PickerOption<T = unknown> {
  value: string;
  label: string;
  hint?: string;
  /** The source row, handed back through `picked` (for summaries). */
  data?: T;
}

interface Results {
  loading: boolean;
  items: PickerOption[];
}

const IDLE: Results = { loading: false, items: [] };

/**
 * Server-side search picker (motorcycles, drivers): the term goes to the API,
 * unlike `app-searchable-select` which filters a preloaded list. Works with
 * `formControlName`; `picked` also emits the whole option.
 */
@Component({
  selector: 'app-remote-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RemotePickerComponent),
      multi: true,
    },
  ],
  templateUrl: './remote-picker.component.html',
  styleUrl: './remote-picker.component.scss',
})
export class RemotePickerComponent implements ControlValueAccessor {
  readonly search = input.required<(term: string) => Observable<PickerOption[]>>();
  readonly placeholder = input('اختر…');
  readonly searchPlaceholder = input('ابحث…');
  readonly icon = input('search');
  /** Option to display for a preset value (the control only holds the id). */
  readonly initial = input<PickerOption | null>(null);
  readonly invalid = input(false);
  readonly inputId = input<string | null>(null);

  readonly picked = output<PickerOption | null>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  protected readonly open = signal(false);
  protected readonly term = signal('');
  protected readonly active = signal(0);
  protected readonly disabled = signal(false);
  private readonly value = signal<string | null>(null);
  private readonly chosen = signal<PickerOption | null>(null);

  protected readonly selected = computed(() => {
    const v = this.value();
    if (!v) return null;
    const c = this.chosen();
    if (c?.value === v) return c;
    const i = this.initial();
    return i?.value === v ? i : { value: v, label: '…' };
  });

  /** Searches only while open; the debounce keeps fast typing to one request. */
  protected readonly results = toSignal(
    toObservable(computed(() => (this.open() ? this.term().trim() : null))).pipe(
      debounceTime(250),
      switchMap((t) =>
        t === null
          ? of(IDLE)
          : this.search()(t).pipe(
              map((items): Results => ({ loading: false, items })),
              startWith<Results>({ loading: true, items: [] }),
            ),
      ),
    ),
    { initialValue: IDLE },
  );

  private onChange: (v: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value.set(v || null);
  }
  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  protected toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.term.set('');
    this.active.set(0);
    this.open.set(true);
    queueMicrotask(() => this.searchBox()?.nativeElement.focus());
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  protected choose(o: PickerOption): void {
    this.chosen.set(o);
    this.value.set(o.value);
    this.onChange(o.value);
    this.picked.emit(o);
    this.close();
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.chosen.set(null);
    this.value.set(null);
    this.onChange(null);
    this.onTouched();
    this.picked.emit(null);
  }

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.results().items;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.update((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const o = items[this.active()];
        if (o) this.choose(o);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
