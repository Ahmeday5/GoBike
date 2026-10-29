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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of } from 'rxjs';
import {
  DOCUMENT_CATEGORY,
  DocumentCategory,
  DocumentOwnerType,
  enumOptions,
} from '@core/constants/enums';
import { DOCUMENT_ACCEPT, DocumentsApi, validateDocumentFile } from '@core/data/documents.api';
import { ApiError } from '@core/models/api-response.model';
import { DocumentDto } from '@core/models/domain.models';
import { ToastService } from '@core/services/toast.service';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { FormErrorComponent } from '@shared/components/form-error/form-error.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  PickerOption,
  RemotePickerComponent,
} from '@shared/components/remote-picker/remote-picker.component';
import { applyServerErrors } from '@shared/forms/server-errors';
import { BytesPipe } from '@shared/pipes/format.pipes';
import { DocumentOwnersLookup } from '../../data-access/document-owners.lookup';
import {
  OWNER_ID_PATTERN,
  OWNER_TYPE_OPTIONS,
  isOwnerSourceType,
  ownerField,
} from '../../models/documents.models';

/**
 * Upload from the documents page: the owner type and the owner are picked
 * here (unlike `app-documents-panel`, where the page fixes them). Opens on
 * the owner the page is currently showing, when there is one.
 */
@Component({
  selector: 'app-upload-document-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    FormErrorComponent,
    IconComponent,
    BytesPipe,
    RemotePickerComponent,
  ],
  templateUrl: './upload-document-dialog.component.html',
  styleUrl: './upload-document-dialog.component.scss',
})
export class UploadDocumentDialogComponent {
  private readonly api = inject(DocumentsApi);
  private readonly toast = inject(ToastService);
  private readonly lookup = inject(DocumentOwnersLookup);

  readonly open = input.required<boolean>();
  /** Owner the page is showing — the dialog starts on it. */
  readonly ownerType = input<DocumentOwnerType | ''>('');
  readonly ownerId = input('');
  readonly closed = output<void>();
  readonly uploaded = output<DocumentDto>();

  protected readonly ownerTypes = OWNER_TYPE_OPTIONS;
  protected readonly categoryOptions = enumOptions(DOCUMENT_CATEGORY);
  protected readonly accept = DOCUMENT_ACCEPT;

  protected readonly uploading = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly dragging = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    ownerType: ['Motorcycle' as DocumentOwnerType, Validators.required],
    ownerId: ['', [Validators.required, Validators.pattern(OWNER_ID_PATTERN)]],
    category: ['Other' as DocumentCategory, Validators.required],
    title: ['', Validators.maxLength(200)],
    expiryDate: [''],
    notes: ['', Validators.maxLength(1000)],
  });

  private readonly selectedType = toSignal(this.form.controls.ownerType.valueChanges, {
    initialValue: this.form.controls.ownerType.value,
  });
  /** Name picker for list-backed types, an id field for the others. */
  protected readonly owner = computed(() => ownerField(this.selectedType()));
  protected readonly search = computed(() => {
    const f = this.owner();
    return (term: string) => (f.kind === 'list' ? this.lookup.search(f.type, term) : of([]));
  });
  /** Label of the preset owner (the control only holds its id). */
  protected readonly presetOption = signal<PickerOption | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const type = this.ownerType();
      const id = this.ownerId();
      untracked(() => this.start(type, id));
    });

    // A new owner type invalidates the chosen owner.
    this.form.controls.ownerType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.ownerId.setValue(''));
  }

  private start(type: DocumentOwnerType | '', id: string): void {
    this.form.reset({ ownerType: type || 'Motorcycle' });
    this.form.controls.ownerId.setValue(type ? id : '');
    this.file.set(null);
    this.fileError.set(null);
    this.presetOption.set(null);
    if (type && id && isOwnerSourceType(type)) {
      this.lookup.resolve(type, id).subscribe((o) => this.presetOption.set(o));
    }
  }

  protected onFileInput(event: Event): void {
    this.pick((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.pick(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected submit(): void {
    const file = this.file();
    if (!file) this.fileError.set('اختر ملفًا للرفع');
    if (this.form.invalid || !file) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.uploading.set(true);
    this.api
      .upload({
        ownerType: v.ownerType,
        ownerId: v.ownerId,
        category: v.category,
        title: v.title.trim() || undefined,
        expiryDate: v.expiryDate || undefined,
        notes: v.notes.trim() || undefined,
        file,
      })
      .subscribe({
        next: (doc) => {
          this.uploading.set(false);
          this.toast.success('تم رفع المستند');
          this.uploaded.emit(doc);
        },
        error: (err: ApiError) => {
          this.uploading.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }

  private pick(file: File | null): void {
    if (!file) return;
    const error = validateDocumentFile(file);
    this.fileError.set(error);
    this.file.set(error ? null : file);
    if (!error && !this.form.controls.title.value) {
      this.form.controls.title.setValue(file.name.replace(/\.[^.]+$/, ''));
    }
  }
}
