import { APP_ROUTES } from '@core/constants/app-routes';
import { DOCUMENT_OWNER_TYPE, DocumentOwnerType, enumOptions } from '@core/constants/enums';
import { DocumentDto } from '@core/models/domain.models';
import { cairoToday } from '@core/utils/cairo-time.util';

export type DocumentsTab = 'all' | 'expiring';

/**
 * Documents page URL state. `ownerType`/`ownerId` apply to "All" (the API
 * needs both before it returns anything), `days`/`includeExpired` to "Expiring".
 */
export type DocumentsQuery = {
  tab: DocumentsTab | '';
  ownerType: DocumentOwnerType | '';
  ownerId: string;
  days: number;
  includeExpired: boolean;
  pageIndex: number;
  pageSize: number;
};

export const DOCUMENTS_QUERY_DEFAULTS: DocumentsQuery = {
  tab: '',
  ownerType: '',
  ownerId: '',
  days: 30,
  includeExpired: true,
  pageIndex: 1,
  pageSize: 20,
};

export const EXPIRING_DAYS_OPTIONS = [7, 30, 60, 90] as const;

/**
 * Owner types whose owners can be listed (each has a list endpoint), so the
 * page can offer "pick the type, then pick the owner". `GET /documents` only
 * returns data for a type AND an owner id together.
 */
export type OwnerSourceType = Extract<
  DocumentOwnerType,
  'Motorcycle' | 'Driver' | 'RentalAssignment' | 'MaintenanceRecord' | 'Office'
>;

export interface OwnerSourceMeta {
  /** Label of the owner field once the type is chosen ("السائق"…). */
  field: string;
  icon: string;
  searchPlaceholder: string;
}

export const OWNER_SOURCES: Readonly<Record<OwnerSourceType, OwnerSourceMeta>> = {
  Motorcycle: {
    field: 'الموتوسيكل',
    icon: 'bike',
    searchPlaceholder: 'ابحث برقم اللوحة أو الكود…',
  },
  Driver: { field: 'السائق', icon: 'user', searchPlaceholder: 'ابحث بالاسم أو رقم الهاتف…' },
  RentalAssignment: {
    field: 'الإيجار',
    icon: 'route',
    searchPlaceholder: 'ابحث برقم اللوحة أو اسم السائق…',
  },
  MaintenanceRecord: {
    field: 'سجل الصيانة',
    icon: 'wrench',
    searchPlaceholder: 'ابحث برقم اللوحة…',
  },
  Office: { field: 'المكتب', icon: 'building', searchPlaceholder: 'ابحث باسم المكتب…' },
};

export function isOwnerSourceType(value: string | null | undefined): value is OwnerSourceType {
  return !!value && value in OWNER_SOURCES;
}

/** Every owner type the API accepts (Swagger `DocumentOwnerType`), in declaration order. */
export const OWNER_TYPE_OPTIONS = enumOptions(DOCUMENT_OWNER_TYPE);

export function isOwnerType(value: string | null | undefined): value is DocumentOwnerType {
  return !!value && value in DOCUMENT_OWNER_TYPE;
}

/** How the owner of a given type is chosen: from a list, or by typing its id. */
export type OwnerField =
  | ({ kind: 'list'; type: OwnerSourceType } & OwnerSourceMeta)
  | { kind: 'id'; type: DocumentOwnerType; field: string; icon: string };

/**
 * Accidents, violations, expenses and invoices have no list endpoint yet, so
 * their owner is entered by id (as Swagger does); the rest get a name picker.
 */
export function ownerField(type: DocumentOwnerType): OwnerField {
  if (isOwnerSourceType(type)) return { kind: 'list', type, ...OWNER_SOURCES[type] };
  const meta = DOCUMENT_OWNER_TYPE[type];
  return { kind: 'id', type, field: `معرّف ${meta.label} (ID)`, icon: meta.icon ?? 'file' };
}

/** Owner ids are GUIDs; anything else would be a guaranteed 400. */
export const OWNER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isOwnerId = (value: string | null | undefined): boolean =>
  !!value && OWNER_ID_PATTERN.test(value.trim());

/** Documents expiring within this many days are flagged amber. */
export const EXPIRY_WARNING_DAYS = 30;

/** Whole days from today (Cairo) to the document's expiry; negative once expired. */
export function daysToExpiry(doc: DocumentDto): number | null {
  if (doc.daysToExpiry != null) return doc.daysToExpiry;
  if (!doc.expiryDate) return null;
  const expiry = Date.parse(doc.expiryDate.slice(0, 10));
  const today = Date.parse(cairoToday());
  return Number.isFinite(expiry) ? Math.round((expiry - today) / 86_400_000) : null;
}

export function expiryTone(doc: DocumentDto): 'danger' | 'warning' | null {
  const days = daysToExpiry(doc);
  if (doc.isExpired || (days != null && days < 0)) return 'danger';
  return days != null && days <= EXPIRY_WARNING_DAYS ? 'warning' : null;
}

/** In-app page of the document's owner, when there is one. */
export function ownerLink(doc: Pick<DocumentDto, 'ownerType' | 'ownerId'>): string | null {
  if (!doc.ownerId) return null;
  switch (doc.ownerType) {
    case 'Motorcycle':
      return APP_ROUTES.motorcycle(doc.ownerId) as string;
    case 'Driver':
      return APP_ROUTES.driver(doc.ownerId);
    default:
      return null;
  }
}
