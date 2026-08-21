// FieldLoop v0.1 — accounting-sync/token-store.ts
// Server-side OAuth token storage + refresh. Secrets (refresh tokens) never
// leave the API; clients only ever trigger a sync, not hold accounting tokens.
// Storage is the `oauth_tokens` Postgres table (service-role only).

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  /** epoch milliseconds */
  expiresAt: number;
  /** MYOB company file base URI */
  companyFileUri?: string;
  /** Xero tenant id */
  tenantId?: string;
}

export type AccountingProvider = 'myob' | 'xero';

export interface TokenStore {
  get(provider: AccountingProvider, entityId?: string): Promise<OAuthToken | null>;
  save(provider: AccountingProvider, token: OAuthToken, entityId?: string): Promise<void>;
}

export type RefreshFn = (refreshToken: string) => Promise<OAuthToken>;

/**
 * Returns a non-expired access token, refreshing (and persisting) it when it is
 * within `skewMs` of expiry. Throws if no token is stored or no refresh token
 * exists for an expired token.
 */
export async function ensureFreshToken(
  store: TokenStore,
  provider: AccountingProvider,
  refresh: RefreshFn,
  entityId?: string,
  skewMs = 60_000,
): Promise<OAuthToken> {
  const token = await store.get(provider, entityId);
  if (!token) {
    throw new Error(`${provider}: no stored OAuth token for entity ${entityId ?? '(default)'}`);
  }
  if (Date.now() < token.expiresAt - skewMs) {
    return token;
  }
  if (!token.refreshToken) {
    throw new Error(`${provider}: token expired and no refresh token is stored`);
  }
  const fresh = await refresh(token.refreshToken);
  const merged: OAuthToken = { ...token, ...fresh };
  await store.save(provider, merged, entityId);
  return merged;
}

/** Persist a token payload from an OAuth token response into our shape. */
export function fromTokenResponse(
  resp: { access_token: string; refresh_token?: string; expires_in?: number },
  extra: { companyFileUri?: string; tenantId?: string } = {},
): OAuthToken {
  return {
    accessToken: resp.access_token,
    refreshToken: resp.refresh_token,
    expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
    ...extra,
  };
}
