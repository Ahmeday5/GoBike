import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, map, of } from 'rxjs';
import { DocumentOwnerType } from '@core/constants/enums';
import { createResource } from '@core/data/resource';
import {
  PickerOption,
  RemotePickerComponent,
} from '@shared/components/remote-picker/remote-picker.component';
import { DocumentOwnersLookup } from '../../data-access/document-owners.lookup';
import {
  OWNER_ID_PATTERN,
  OWNER_TYPE_OPTIONS,
  isOwnerType,
  ownerField,
} from '../../models/documents.models';

export interface OwnerSelection {
  ownerType: DocumentOwnerType | '';
  ownerId: string;
}

/** Typing pause before a pasted/typed id is applied. */
const ID_DEBOUNCE_MS = 400;

/**
 * "Type → owner" filter. Owner types with a list endpoint get a server-searched
 * name picker; the others (accidents, violations…) take the owner's id. The
 * parent owns both values (in the URL); this only reports changes, and labels
 * an id that arrives from the URL.
 */
@Component({
  selector: 'app-owner-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RemotePickerComponent],
  template: `
    <select
      class="form-select of-type"
      aria-label="نوع المالك"
      [value]="ownerType()"
      (change)="onType($event)"
    >
      <option value="">اختر النوع…</option>
      @for (t of types; track t.value) {
        <option [value]="t.value">{{ t.label }}</option>
      }
    </select>

    @if (field(); as f) {
      @if (f.kind === 'list') {
        <app-remote-picker
          class="of-owner"
          [attr.aria-label]="f.field"
          [formControl]="owner"
          [search]="search()"
          [initial]="initial()"
          [icon]="f.icon"
          [placeholder]="'اختر ' + f.field + '…'"
          [searchPlaceholder]="f.searchPlaceholder"
          (picked)="picked.set($event)"
        />
      } @else {
        <input
          type="text"
          class="form-control ltr of-owner"
          [class.is-invalid]="idInput.invalid"
          [attr.aria-label]="f.field"
          [placeholder]="f.field + ' — xxxxxxxx-xxxx-…'"
          spellcheck="false"
          autocomplete="off"
          [formControl]="idInput"
          [title]="idInput.invalid ? 'المعرّف يجب أن يكون بصيغة GUID' : f.field"
        />
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .of-type {
      max-width: 12rem;
    }
    .of-owner {
      flex: 1 1 16rem;
      max-width: 22rem;
    }
  `,
})
export class OwnerFilterComponent {
  private readonly lookup = inject(DocumentOwnersLookup);

  readonly ownerType = input.required<DocumentOwnerType | ''>();
  readonly ownerId = input.required<string>();
  readonly changed = output<OwnerSelection>();

  protected readonly types = OWNER_TYPE_OPTIONS;
  /** Name picker value (list-backed types). */
  protected readonly owner = new FormControl<string | null>(null);
  /** Raw id (types without a list endpoint). */
  protected readonly idInput = new FormControl('', {
    nonNullable: true,
    validators: Validators.pattern(OWNER_ID_PATTERN),
  });

  protected readonly field = computed(() => {
    const type = this.ownerType();
    return type ? ownerField(type) : null;
  });
  protected readonly search = computed(() => {
    const f = this.field();
    return (term: string) => (f?.kind === 'list' ? this.lookup.search(f.type, term) : of([]));
  });

  /** The option the user just chose — no need to look its name up again. */
  protected readonly picked = signal<PickerOption | null>(null);
  private readonly resolved = createResource(
    () => {
      const f = this.field();
      const id = this.ownerId();
      return f?.kind === 'list' && id && this.picked()?.value !== id ? { type: f.type, id } : null;
    },
    ({ type, id }) => this.lookup.resolve(type, id),
  );
  protected readonly initial = computed(() => {
    const id = this.ownerId();
    const picked = this.picked();
    if (picked?.value === id) return picked;
    const resolved = this.resolved.value();
    return resolved?.value === id ? resolved : null;
  });

  constructor() {
    // URL → inputs (back/forward, "clear filters"), without echoing it back.
    effect(() => {
      const id = this.ownerId();
      untracked(() => {
        this.owner.setValue(id || null, { emitEvent: false });
        if (this.idInput.value.trim() !== id) this.idInput.setValue(id, { emitEvent: false });
      });
    });

    this.owner.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => this.emit(id ?? ''));

    // Applied once typing pauses, and only when it's empty or a well-formed id.
    this.idInput.valueChanges
      .pipe(
        debounceTime(ID_DEBOUNCE_MS),
        map((v) => v.trim()),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        if (id === this.ownerId() || (id && !OWNER_ID_PATTERN.test(id))) return;
        this.emit(id);
      });
  }

  protected onType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.picked.set(null);
    this.changed.emit({ ownerType: isOwnerType(value) ? value : '', ownerId: '' });
  }

  private emit(ownerId: string): void {
    this.changed.emit({ ownerType: this.ownerType(), ownerId });
  }
}
