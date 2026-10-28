/** URL-backed filters for `GET /users`. Empty string = "any". */
export type UsersQuery = {
  search: string;
  role: string;
  officeId: string;
  isActive: '' | 'true' | 'false';
  sortBy: 'name' | 'email' | 'createdAt' | 'lastLogin' | '';
  sortDesc: boolean;
  pageIndex: number;
  pageSize: number;
};

export const USERS_QUERY_DEFAULTS: UsersQuery = {
  search: '',
  role: '',
  officeId: '',
  isActive: '',
  sortBy: '',
  sortDesc: false,
  pageIndex: 1,
  pageSize: 20,
};

/** `POST /users` (Swagger: CreateUserRequest). */
export interface CreateUserRequest {
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  password: string;
  /** null = company-wide user (sees every office). */
  officeId?: string | null;
  roles: string[];
}

/** `PUT /users/{id}` (Swagger: UpdateUserRequest). */
export interface UpdateUserRequest {
  fullName: string;
  phoneNumber?: string | null;
  officeId?: string | null;
}

/** `PUT /users/{id}/roles` (Swagger: SetUserRolesRequest). */
export interface SetUserRolesRequest {
  roles: string[];
}

/** `POST /users/{id}/reset-password` (Swagger: AdminResetPasswordRequest). */
export interface AdminResetPasswordRequest {
  newPassword: string;
}

const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?';

/**
 * Strong random password with at least one char of every class, so it passes
 * the backend's identity rules whatever they are. Ambiguous glyphs (0/O, 1/l)
 * are left out because admins read it out to people.
 */
export function generatePassword(length = 12): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const all = LOWER + UPPER + DIGITS;
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
