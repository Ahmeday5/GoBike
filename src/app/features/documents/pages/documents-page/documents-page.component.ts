import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from '@core/auth/constants/permissions';
import {
  DOCUMENT_CATEGORY,
  DOCUMENT_OWNER_TYPE,
  DocumentOwnerType,
  enumLabel,
  enumMeta,
} from '@core/constants/enums';
import { DocumentsApi } from '@core/data/documents.api';
import { createResource } from '@core/data/resource';
import { DocumentDto } from '@core/models/domain.models';
import { DashboardHubService } from '@core/realtime/dashboard-hub.service';
import { injectUrlState } from '@core/routing/url-state';
import { DialogService } from '@core/services/dialog.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabItem, TabsComponent } from '@shared/components/tabs/tabs.component';
import {
  DataTableComponent,
  TableColumn,
} from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ChipComponent, EnumChipComponent } from '@shared/components/chip/chip.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { BytesPipe, CairoDatePipe } from '@shared/pipes/format.pipes';
import {
  DOCUMENTS_QUERY_DEFAULTS,
  DocumentsQuery,
  DocumentsTab,
  EXPIRING_DAYS_OPTIONS,
  daysToExpiry,
  expiryTone,
  isOwnerId,
  isOwnerType,
  ownerField,
  ownerLink,
} from '../../models/documents.models';
import { UploadDocumentDialogComponent } from '../../components/upload-document-dialog/upload-document-dialog.component';
import {
  OwnerFilterComponent,
  OwnerSelection,
} from '../../components/owner-filter/owner-filter.component';

type Row = TemplateRef<{ $implicit: DocumentDto }>;

/**
 * 5.14 — Every document across owners ("All") and the ones about to expire
 * ("Expiring soon"). Both endpoints return the whole list, so paging is
 * client-side; tab, filters and page are in the URL.
 */
@Component({
  selector: 'app-documents-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    TabsComponent,
    DataTableComponent,
    PaginationComponent,
    ChipComponent,
    EnumChipComponent,
    IconComponent,
    HasPermissionDirective,
    BytesPipe,
    CairoDatePipe,
    UploadDocumentDialogComponent,
    OwnerFilterComponent,
    EmptyStateComponent,
  ],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
})
export class DocumentsPageComponent {
  private readonly api = inject(DocumentsApi);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly P = PERMISSIONS;
  protected readonly CATEGORY = DOCUMENT_CATEGORY;
  protected readonly daysOptions = EXPIRING_DAYS_OPTIONS;
  protected readonly expiryTone = expiryTone;
  protected readonly daysToExpiry = daysToExpiry;
  protected readonly ownerLink = ownerLink;
  protected readonly categoryIcon = (d: DocumentDto) =>
    enumMeta(DOCUMENT_CATEGORY, d.category).icon ?? 'file';
  protected readonly ownerTypeLabel = (d: DocumentDto) =>
    enumLabel(DOCUMENT_OWNER_TYPE, d.ownerType);

  protected readonly filters = injectUrlState<DocumentsQuery>(DOCUMENTS_QUERY_DEFAULTS);
  protected readonly f = this.filters.state;

  protected readonly activeTab = computed<DocumentsTab>(() =>
    this.f().tab === 'expiring' ? 'expiring' : 'all',
  );

  /** Owner type from the URL, ignoring values the API doesn't know. */
  protected readonly ownerType = computed<DocumentOwnerType | ''>(() => {
    const type = this.f().ownerType;
    return isOwnerType(type) ? type : '';
  });
  protected readonly ownerSource = computed(() => {
    const type = this.ownerType();
    return type ? ownerField(type) : null;
  });
  /** "All" lists one owner's documents: nothing is requested until both are chosen. */
  protected readonly ownerChosen = computed(
    () => !!this.ownerType() && isOwnerId(this.f().ownerId),
  );

  /** Only the inputs of the active tab drive the request. */
  private readonly request = computed(() => {
    const f = this.f();
    if (this.activeTab() === 'expiring') {
      return { tab: 'expiring' as const, days: f.days, includeExpired: f.includeExpired };
    }
    return this.ownerChosen()
      ? { tab: 'all' as const, ownerType: this.ownerType(), ownerId: f.ownerId }
      : null;
  });

  protected readonly docs = createResource(
    () => this.request(),
    (r) =>
      r.tab === 'expiring'
        ? this.api.expiring(r.days, r.includeExpired)
        : this.api.list(r.ownerType, r.ownerId),
    { refetchOn: inject(DashboardHubService).reconnected$ },
  );

  /** A cleared owner must not leave the previous owner's rows on screen. */
  private readonly all = computed(() =>
    this.request() ? (this.docs.value() ?? []) : ([] as DocumentDto[]),
  );
  protected readonly rows = computed(() => {
    const { pageIndex, pageSize } = this.f();
    return this.all().slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  });
  protected readonly count = computed(() => this.all().length);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.count() / this.f().pageSize)),
  );

  /** Expiring count for the tab badge (default window), independent of the active tab. */
  private readonly expiringCount = createResource(
    () => this.f().days,
    (days) => this.api.expiring(days, true),
  );

  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'all', label: 'كل المستندات', icon: 'archive' },
    {
      id: 'expiring',
      label: 'قاربت على الانتهاء',
      icon: 'clock',
      badge: this.expiringCount.value()?.length ?? null,
    },
  ]);

  protected readonly hasFilters = computed(() => {
    const f = this.f();
    return this.activeTab() === 'all'
      ? !!(f.ownerType || f.ownerId)
      : f.days !== DOCUMENTS_QUERY_DEFAULTS.days || !f.includeExpired;
  });

  protected readonly uploadOpen = signal(false);
  protected readonly busyId = signal<string | null>(null);

  private readonly titleTpl = viewChild<Row>('titleTpl');
  private readonly categoryTpl = viewChild<Row>('categoryTpl');
  private readonly ownerTpl = viewChild<Row>('ownerTpl');
  private readonly expiryTpl = viewChild<Row>('expiryTpl');
  private readonly sizeTpl = viewChild<Row>('sizeTpl');
  private readonly uploadedTpl = viewChild<Row>('uploadedTpl');
  private readonly actionsTpl = viewChild<Row>('actionsTpl');

  protected readonly columns = computed<TableColumn<DocumentDto>[]>(() => [
    { key: 'title', label: 'المستند', cellTemplate: this.titleTpl() },
    { key: 'category', label: 'التصنيف', cellTemplate: this.categoryTpl() },
    { key: 'ownerName', label: 'يخص', cellTemplate: this.ownerTpl() },
    { key: 'expiryDate', label: 'الانتهاء', cellTemplate: this.expiryTpl() },
    { key: 'sizeBytes', label: 'الحجم', cellTemplate: this.sizeTpl() },
    { key: 'uploadedAtUtc', label: 'تاريخ الرفع', cellTemplate: this.uploadedTpl() },
    { key: 'actions', label: '', align: 'end', cellTemplate: this.actionsTpl() },
  ]);

  /** Tab switch keeps nothing but the tab (each tab has its own filters). */
  protected setTab(tab: string): void {
    if (tab === this.activeTab()) return;
    this.filters.patch({
      ...DOCUMENTS_QUERY_DEFAULTS,
      tab: tab === 'expiring' ? 'expiring' : '',
    });
  }

  protected selectOwner(selection: OwnerSelection): void {
    this.filters.patch(selection);
  }

  protected selectDays(event: Event): void {
    this.filters.patch({ days: Number((event.target as HTMLSelectElement).value) });
  }

  protected toggleExpired(event: Event): void {
    this.filters.patch({ includeExpired: (event.target as HTMLInputElement).checked });
  }

  protected clearFilters(): void {
    const tab = this.f().tab;
    this.filters.patch({ ...DOCUMENTS_QUERY_DEFAULTS, tab });
  }

  protected download(doc: DocumentDto): void {
    this.busyId.set(doc.id);
    this.api.download(doc).subscribe({
      next: () => this.busyId.set(null),
      error: () => this.busyId.set(null),
    });
  }

  protected async remove(doc: DocumentDto): Promise<void> {
    const name = doc.title || doc.fileName || 'المستند';
    const owner = doc.ownerName ? ` الخاص بـ ${doc.ownerName}` : '';
    const ok = await this.dialog.confirm({
      title: 'حذف المستند',
      message: `سيتم حذف "${name}"${owner} نهائيًا ولا يمكن استرجاعه.`,
      type: 'danger',
      confirmText: 'حذف',
    });
    if (!ok) return;
    this.api.delete(doc.id).subscribe(() => {
      this.toast.success('تم حذف المستند');
      this.docs.update((list) => list?.filter((d) => d.id !== doc.id));
      this.expiringCount.reload();
    });
  }

  /** Lands on the uploaded file's owner so the new document is in view. */
  protected onUploaded(doc: DocumentDto): void {
    this.uploadOpen.set(false);
    this.expiringCount.reload();
    const f = this.f();
    const sameOwner = doc.ownerType === f.ownerType && doc.ownerId === f.ownerId;
    if (this.activeTab() === 'all' && !sameOwner) {
      this.filters.patch({ ownerType: doc.ownerType, ownerId: doc.ownerId });
    } else {
      this.docs.reload();
    }
  }
}
