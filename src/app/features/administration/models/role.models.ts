import { STAFF_ROLE, enumMeta } from '@core/constants/enums';

/** A role, normalized from `GET /roles` (items may be `{ name, permissions }` or a bare name). */
export interface RoleView {
  name: string;
  permissions: string[];
  userCount?: number | null;
  description?: string | null;
  /** Seeded by the backend (flagged by the API, or one of the known staff roles). */
  builtIn: boolean;
}

/** `POST /roles` (Swagger: CreateRoleRequest). */
export interface CreateRoleRequest {
  name: string;
  permissions: string[];
}

/** `PUT /roles/{name}/permissions` (Swagger: UpdateRolePermissionsRequest). */
export interface UpdateRolePermissionsRequest {
  permissions: string[];
}

/** Reserved by the backend for mobile-app drivers (who are not dashboard users). */
export const RESERVED_ROLE_NAME = 'Driver';
/** Always holds every permission; edited only by the backend seed. */
export const ADMIN_ROLE_NAME = 'Admin';

/** Seeded staff roles — can't be deleted from the UI. */
export const BUILT_IN_ROLES: readonly string[] = Object.keys(STAFF_ROLE);

export const isReservedRole = (name: string): boolean =>
  name.trim().toLowerCase() === RESERVED_ROLE_NAME.toLowerCase();

export const isBuiltInRole = (name: string): boolean =>
  BUILT_IN_ROLES.some((r) => r.toLowerCase() === name.trim().toLowerCase());

/** Arabic label for seeded roles; custom roles are shown by their name. */
export const roleLabel = (name: string): string => enumMeta(STAFF_ROLE, name).label;

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

function permissionName(p: unknown): string | null {
  if (typeof p === 'string') return asString(p);
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>;
    return asString(o['name']) ?? asString(o['permission']) ?? asString(o['value']);
  }
  return null;
}

/** Any permission list shape (`string[]`, `{ name }[]`) → unique names. */
export function normalizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(permissionName).filter((p): p is string => !!p))];
}

/** Any role shape → RoleView, or null when it has no usable name. */
export function normalizeRole(raw: unknown): RoleView | null {
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name, permissions: [], builtIn: isBuiltInRole(name) } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o['name']) ?? asString(o['roleName']);
  if (!name) return null;
  const count = o['userCount'] ?? o['usersCount'] ?? o['membersCount'];
  const flag = o['isBuiltIn'] ?? o['isSystem'] ?? o['isSeeded'] ?? o['builtIn'];
  return {
    name,
    permissions: normalizePermissions(o['permissions'] ?? o['claims']),
    userCount: typeof count === 'number' ? count : null,
    description: asString(o['description']),
    builtIn: flag === true || isBuiltInRole(name),
  };
}
