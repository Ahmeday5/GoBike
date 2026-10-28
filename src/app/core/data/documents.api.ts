import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AppConfigService } from '../config/app-config.service';
import { withSkipLoader } from '../http/http-context.tokens';
import { asList } from '../utils/api-list.util';
import { DocumentDto } from '../models/domain.models';
import { DocumentCategory, DocumentOwnerType } from '../constants/enums';

export interface UploadDocumentRequest {
  ownerType: DocumentOwnerType;
  ownerId: string;
  category: DocumentCategory;
  title?: string;
  /** DateOnly `yyyy-MM-dd`. */
  expiryDate?: string;
  notes?: string;
  file: File;
}

export interface UpdateDocumentRequest {
  category: DocumentCategory;
  title?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

/** Upload limits from the API brief — validated client-side before sending. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';
const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp)$/i;

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_EXT.test(file.name)) return 'نوع الملف غير مدعوم (المسموح: PDF و JPG و PNG و WEBP)';
  if (file.size > DOCUMENT_MAX_BYTES) return 'حجم الملف أكبر من 10 ميجابايت';
  return null;
}

/**
 * Documents (`/documents`). Shared because documents attach to many owners
 * (motorcycles, drivers, rentals…) and appear as a tab on several pages.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  list(ownerType?: DocumentOwnerType | '', ownerId?: string): Observable<DocumentDto[]> {
    return this.api
      .get<unknown>('documents', { params: { ownerType, ownerId }, context: withSkipLoader() })
      .pipe(map((r) => asList<DocumentDto>(r)));
  }

  expiring(days = 30, includeExpired = true): Observable<DocumentDto[]> {
    return this.api
      .get<unknown>('documents/expiring', {
        params: { days, includeExpired },
        context: withSkipLoader(),
      })
      .pipe(map((r) => asList<DocumentDto>(r)));
  }

  upload(req: UploadDocumentRequest): Observable<DocumentDto> {
    const form = new FormData();
    form.append('ownerType', req.ownerType);
    form.append('ownerId', req.ownerId);
    form.append('category', req.category);
    if (req.title) form.append('title', req.title);
    if (req.expiryDate) form.append('expiryDate', req.expiryDate);
    if (req.notes) form.append('notes', req.notes);
    form.append('file', req.file, req.file.name);
    return this.api.post<DocumentDto>('documents', form, { context: withSkipLoader() });
  }

  update(id: string, req: UpdateDocumentRequest): Observable<DocumentDto> {
    return this.api.put<DocumentDto>(`documents/${id}`, req);
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete(`documents/${id}`);
  }

  /**
   * Fetches the file with the Bearer token (a plain link can't send it) and
   * triggers a browser download.
   */
  download(doc: Pick<DocumentDto, 'id' | 'fileName' | 'title'>): Observable<void> {
    const url = `${this.config.apiUrl.replace(/\/+$/, '')}/documents/${doc.id}/download`;
    return this.http.get(url, { responseType: 'blob', context: withSkipLoader() }).pipe(
      map((blob) => {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = doc.fileName || doc.title || 'document';
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
      }),
    );
  }
}
