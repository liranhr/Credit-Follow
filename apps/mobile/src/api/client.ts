import type { AuthResponse } from '@credit-follow/shared';
import { tokenStorage } from '@/auth/tokenStorage';
import { env } from '@/config/env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Session {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
}

const REQUEST_TIMEOUT_MS = 15_000;
/** Refresh the access token a little before it expires. */
const EXPIRY_MARGIN_MS = 30_000;

let session: Session | null = null;
let refreshInFlight: Promise<AuthResponse> | null = null;
let sessionEndedHandler: (() => void) | null = null;

/** Called when the session can no longer be refreshed (expired, revoked, account deleted). */
export function setSessionEndedHandler(handler: (() => void) | null): void {
  sessionEndedHandler = handler;
}

export async function storeSession(auth: AuthResponse): Promise<void> {
  session = {
    accessToken: auth.accessToken,
    accessTokenExpiresAt: Date.parse(auth.accessTokenExpiresAt),
    refreshToken: auth.refreshToken,
  };
  await tokenStorage.set(auth.refreshToken);
}

export async function clearSession(): Promise<void> {
  session = null;
  await tokenStorage.clear();
}

export function getRefreshToken(): string | null {
  return session?.refreshToken ?? null;
}

async function rawRequest<T>(
  path: string,
  init: { method: string; body?: unknown; accessToken?: string },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(init.accessToken && { Authorization: `Bearer ${init.accessToken}` }),
      },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const json = (await response.json().catch(() => null)) as
    (T & { error?: { code: string; message: string; details?: unknown } }) | null;
  if (!response.ok) {
    const error = json?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `HTTP ${response.status}`,
      error?.details,
    );
  }
  return json as T;
}

async function endSession(): Promise<void> {
  await clearSession();
  sessionEndedHandler?.();
}

/**
 * Exchanges the refresh token for a new session. Concurrent callers share one request,
 * because the API rotates refresh tokens and treats reuse of an old one as theft.
 */
export function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = session?.refreshToken ?? (await tokenStorage.get());
      if (!refreshToken) throw new ApiError(401, 'NO_SESSION', 'No session');
      const auth = await rawRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await storeSession(auth);
      return auth;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await endSession();
      throw error;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function getAccessToken(): Promise<string> {
  if (!session || session.accessTokenExpiresAt - EXPIRY_MARGIN_MS <= Date.now()) {
    await refreshSession();
  }
  return session!.accessToken;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token (default true). */
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (options.auth === false) return rawRequest<T>(path, { method, body: options.body });

  try {
    return await rawRequest<T>(path, {
      method,
      body: options.body,
      accessToken: await getAccessToken(),
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (error.code === 'TOKEN_INVALID') {
      // Access token expired early (e.g. device clock skew): refresh once and retry.
      await refreshSession();
      return rawRequest<T>(path, { method, body: options.body, accessToken: session!.accessToken });
    }
    await endSession();
    throw error;
  }
}
