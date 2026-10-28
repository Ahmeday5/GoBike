/**
 * Dashboard role name. Kept as `string` because admins can create new roles
 * from the Roles screen; the seeded ones are listed in `constants/roles.ts`.
 */
export type UserRole = string;

export interface User {
  id: string;
  name: string;
  email: string;
  /** Primary role (first of `roles`), kept for display. */
  role: UserRole;
  roles: UserRole[];
  avatar: string;
  permissions: string[];
  /** Office the user belongs to; null for company-wide users. */
  officeId: string | null;
  /** Can see every office (the office filter is only shown to these users). */
  hasGlobalScope: boolean;
}

/** Local, normalized token bundle used everywhere inside the app. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Millisecond epoch — sourced from the JWT `exp` claim. */
  expiresAt: number;
}

// ─────────── Wire shapes — adjust to match your backend exactly ───────────

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
  deviceInfo: string;
  deviceId: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceInfo: string;
  deviceId: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

/**
 * Shape returned in the `data` field for /auth/login and /auth/refresh-token.
 * On refresh, user fields may come back empty — never overwrite the cached
 * user with an empty payload.
 */
export interface AuthResponseData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
  userName: string | null;
  /** The user's role name, e.g. `"Admin"`. Source of truth for role checks. */
  role?: string | null;
  /** Flat array of permission strings (e.g. `"Users.Manage"`). */
  permissions?: ReadonlyArray<string> | null;
  /** ISO date — treated as a hint only; the JWT `exp` claim is authoritative. */
  expiresAtUtc: string;
}

/**
 * `data` of `GET /auth/me` — the authoritative profile, roles, permissions
 * and office scope. Fetched right after login (the login payload carries no
 * permissions) and again whenever the app shell boots, so permission edits
 * made on the Roles screen reach already-signed-in users.
 */
export interface MePermissionsData {
  userId?: string | null;
  id?: string | null;
  userName?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: ReadonlyArray<string> | null;
  permissions?: ReadonlyArray<string> | null;
  officeId?: string | null;
  hasGlobalScope?: boolean | null;
}
