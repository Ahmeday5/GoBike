import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DocumentsApi, DOCUMENT_ACCEPT, validateDocumentFile } from '@core/data/documents.api';
import { createResource } from '@core/data/resource';
import { DocumentDto } from '@core/models/domain.models';
import { ApiError } from '@core/models/api-response.model';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import {
  DOCUMENT_CATEGORY,
  DocumentCategory,
  DocumentOwnerType,
  enumMeta,
  enumOptions,
} from '@core/constants/enums';
import { HasPermissionDirective } from '../../directives/has-permission.directive';
import { applyServerErrors } from '../../forms/server-errors';
import { BytesPipe, CairoDatePipe } from '../../pipes/format.pipes';
import { EnumChipComponent, ChipComponent } from '../chip/chip.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { IconComponent } from '../icon/icon.component';
import { ModalComponent } from '../modal/modal.component';
import { FormErrorComponent } from '../form-error/form-error.component';

/** Documents expiring within this many days get a warning chip. */
const EXPIRY_WARNING_DAYS = 30;

/**
 * Documents attached to one owner (a motorcycle, a driver…): list, upload,
 * download, delete. Drop it into any detail page's "Documents" tab:
 *
 *   <app-documents-panel ownerType="Motorcycle" [ownerId]="id" />
 */
@Component({
  selector: 'app-documents-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    HasPermissionDirective,
    BytesPipe,
    CairoDatePipe,
    EnumChipComponent,
    ChipComponent,
    EmptyStateComponent,
    IconComponent,
    ModalComponent,
    FormErrorComponent,
  ],
  templateUrl: './documents-panel.component.html',
  styleUrl: './documents-panel.component.scss',
})
export class DocumentsPanelComponent {
  private readonly api = inject(DocumentsApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly ownerType = input.required<DocumentOwnerType>();
  readonly ownerId = input.required<string>();

  protected readonly P = PERMISSIONS;
  protected readonly CATEGORY = DOCUMENT_CATEGORY;
  protected readonly categoryOptions = enumOptions(DOCUMENT_CATEGORY);

  /** Tolerates categories the backend may add later. */
  protected categoryIcon(category: string): string {
    return enumMeta(DOCUMENT_CATEGORY, category).icon ?? 'file';
  }
  protected readonly accept = DOCUMENT_ACCEPT;

  protected readonly docs = createResource(
    () => ({ type: this.ownerType(), id: this.ownerId() }),
    ({ type, id }) => this.api.list(type, id),
  );

  protected readonly uploadOpen = signal(false);
  protected readonly uploading = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    category: ['Other' as DocumentCategory, Validators.required],
    title: [''],
    expiryDate: [''],
    notes: [''],
  });

  protected expiryTone(doc: DocumentDto): 'danger' | 'warning' | null {
    if (!doc.expiryDate) return null;
    const days = Math.ceil((Date.parse(doc.expiryDate) - Date.now()) / 86_400_000);
    if (doc.isExpired || days < 0) return 'danger';
    return days <= EXPIRY_WARNING_DAYS ? 'warning' : null;
  }

  protected openUpload(): void {
    this.form.reset({ category: 'Other', title: '', expiryDate: '', notes: '' });
    this.file.set(null);
    this.fileError.set(null);
    this.uploadOpen.set(true);
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

  protected upload(): void {
    const file = this.file();
    if (!file) {
      this.fileError.set('اختر ملفًا للرفع');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.uploading.set(true);
    this.api
      .upload({
        ownerType: this.ownerType(),
        ownerId: this.ownerId(),
        category: v.category,
        title: v.title || undefined,
        expiryDate: v.expiryDate || undefined,
        notes: v.notes || undefined,
        file,
      })
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.uploadOpen.set(false);
          this.toast.success('تم رفع المستند');
          this.docs.reload();
        },
        error: (err: ApiError) => {
          this.uploading.set(false);
          applyServerErrors(this.form, err, this.toast);
        },
      });
  }

  protected download(doc: DocumentDto): void {
    this.busyId.set(doc.id);
    this.api.download(doc).subscribe({
      next: () => this.busyId.set(null),
      error: () => this.busyId.set(null),
    });
  }

  protected async remove(doc: DocumentDto): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'حذف المستند',
      message: `سيتم حذف "${doc.title || doc.fileName || 'المستند'}" نهائيًا.`,
      type: 'danger',
      confirmText: 'حذف',
    });
    if (!ok) return;
    this.api.delete(doc.id).subscribe(() => {
      this.toast.success('تم حذف المستند');
      this.docs.update((list) => list?.filter((d) => d.id !== doc.id));
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
