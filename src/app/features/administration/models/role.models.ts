/** A role, normalized from `GET /roles` (items may be `{ name, permissions }` or a bare name). */
export interface RoleView {
  name: string;
  permissions: string[];
  userCount?: number | null;
  description?: string | null;
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
  if (typeof raw === 'string') return raw.trim() ? { name: raw.trim(), permissions: [] } : null;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o['name']) ?? asString(o['roleName']);
  if (!name) return null;
  const count = o['userCount'] ?? o['usersCount'];
  return {
    name,
    permissions: normalizePermissions(o['permissions'] ?? o['claims']),
    userCount: typeof count === 'number' ? count : null,
    description: asString(o['description']),
  };
}
