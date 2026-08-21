// FieldLoop v0.1 — accounting-sync/myob.ts
// MYOB Business API v2 connector.
// - Pushes itemized DRAFT sales invoices (Status: Open) tied to the parent ABN.
// - Pulls contacts / tax codes for the company file.
// Uses native fetch (Node 22). axios is a drop-in alternative if preferred.

import { ensureFreshToken, fromTokenResponse, TokenStore } from './token-store.js';

export interface MyobCredentials {
  clientId: string;
  clientSecret: string;
  /** MYOB developer API key */
  myobApiKey: string;
}

const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize';

export interface MyobLineItem {
  description: string;
  totalIncGst: number;
  taxCodeUid: string;
}

export interface MYOBInvoicePayload {
  companyFileUri: string;
  accessToken: string;
  myobApiKey: string;
  customerUid: string;
  invoiceNumber: string;
  date: string; // ISO date, e.g. 2026-08-19
  lineItems: MyobLineItem[];
  journalMemo?: string;
}

export interface MyobInvoiceResult {
  uid: string;
  number: string;
  uri: string;
}

/** Refresh a MYOB access token (OAuth2 refresh grant). */
export async function refreshMyobToken(
  refreshToken: string,
  creds: MyobCredentials,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'CompanyFile',
  });
  const res = await fetch(MYOB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`MYOB token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return fromTokenResponse(json);
}

/** Fetch the company files (companyFileUri values) the token can access. */
export async function listMyobCompanyFiles(accessToken: string, myobApiKey: string) {
  const res = await fetch('https://api.myob.com/accountright/', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-myobapi-key': myobApiKey,
      'x-myobapi-version': 'v2',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`MYOB company files failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Push an itemized draft sales invoice to a MYOB company file. */
export async function pushDraftInvoiceToMYOB(
  payload: MYOBInvoicePayload,
): Promise<MyobInvoiceResult> {
  const endpoint = `${payload.companyFileUri.replace(/\/$/, '')}/Sale/Invoice/InvoiceService`;
  const body = {
    Number: payload.invoiceNumber,
    Date: payload.date,
    Customer: { UID: payload.customerUid },
    IsTaxInclusive: true,
    Lines: payload.lineItems.map((item) => ({
      Type: 'Service',
      Description: item.description,
      Total: item.totalIncGst,
      TaxCode: { UID: item.taxCodeUid },
    })),
    Status: 'Open',
    JournalMemo: payload.journalMemo ?? 'FieldLoop Auto-Sync',
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      'x-myobapi-key': payload.myobApiKey,
      'x-myobapi-version': 'v2',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // MYOB returns a duplicate error if the invoice number already exists; the
    // caller should treat that as idempotent success.
    throw new Error(`MYOB invoice push failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<MyobInvoiceResult>;
}

/**
 * High-level sync: resolve a fresh token from the store, then push the invoice.
 * This is the function the API layer calls — clients never pass access tokens.
 */
export async function syncInvoiceToMyob(
  store: TokenStore,
  creds: MyobCredentials,
  entityId: string | undefined,
  invoice: Omit<MYOBInvoicePayload, 'accessToken' | 'myobApiKey' | 'companyFileUri'>,
): Promise<MyobInvoiceResult> {
  const token = await ensureFreshToken(
    store,
    'myob',
    (rt) => refreshMyobToken(rt, creds),
    entityId,
  );
  if (!token.companyFileUri) {
    throw new Error('MYOB token is missing companyFileUri');
  }
  return pushDraftInvoiceToMYOB({
    ...invoice,
    companyFileUri: token.companyFileUri,
    accessToken: token.accessToken,
    myobApiKey: creds.myobApiKey,
  });
}
