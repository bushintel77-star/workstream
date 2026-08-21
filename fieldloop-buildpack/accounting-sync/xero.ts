// FieldLoop v0.1 — accounting-sync/xero.ts
// Xero Accounting API connector (OAuth2, rotating refresh tokens).
// - Pulls contacts/accounts; pushes itemized DRAFT sales invoices (ACCREC).

import { ensureFreshToken, fromTokenResponse, TokenStore } from './token-store.js';

export interface XeroCredentials {
  clientId: string;
  clientSecret: string;
}

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

export interface XeroLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  /** Xero tax type, e.g. 'OUTPUT' for 10% GST, 'OUTPUT2' for GST-free. */
  taxType: string;
  accountCode: string;
}

export interface XeroInvoicePayload {
  tenantId: string;
  accessToken: string;
  contactId: string;
  invoiceNumber: string;
  date: string; // ISO date
  dueDate: string; // ISO date
  lineItems: XeroLineItem[];
  reference?: string;
}

export interface XeroInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
}

/** Refresh a Xero access token (OAuth2 refresh grant, Basic auth client). */
export async function refreshXeroToken(
  refreshToken: string,
  creds: XeroCredentials,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`Xero token refresh failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return fromTokenResponse(json);
}

/** Pull contacts so office staff can map a FieldLoop client to a Xero ContactID. */
export async function listXeroContacts(tenantId: string, accessToken: string) {
  const res = await fetch(`${XERO_API_BASE}/Contacts?summaryOnly=true`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Xero contacts failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Push an itemized draft sales invoice (ACCREC) to Xero. */
export async function pushDraftInvoiceToXero(
  payload: XeroInvoicePayload,
): Promise<XeroInvoiceResult> {
  const body = {
    Invoices: [
      {
        Type: 'ACCREC',
        Contact: { ContactID: payload.contactId },
        Date: payload.date,
        DueDate: payload.dueDate,
        InvoiceNumber: payload.invoiceNumber,
        Reference: payload.reference ?? 'FieldLoop Auto-Sync',
        LineAmountTypes: 'Inclusive',
        Status: 'DRAFT',
        LineItems: payload.lineItems.map((item) => ({
          Description: item.description,
          Quantity: item.quantity,
          UnitAmount: item.unitAmount,
          TaxType: item.taxType,
          AccountCode: item.accountCode,
        })),
      },
    ],
  };

  const res = await fetch(`${XERO_API_BASE}/Invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      'Xero-Tenant-Id': payload.tenantId,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Xero invoice push failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    Invoices: Array<{ InvoiceID: string; InvoiceNumber: string; Status: string }>;
  };
  const inv = json.Invoices?.[0];
  return { invoiceId: inv.InvoiceID, invoiceNumber: inv.InvoiceNumber, status: inv.Status };
}

/** High-level sync using the token store (clients never hold Xero tokens). */
export async function syncInvoiceToXero(
  store: TokenStore,
  creds: XeroCredentials,
  entityId: string | undefined,
  invoice: Omit<XeroInvoicePayload, 'accessToken' | 'tenantId'>,
): Promise<XeroInvoiceResult> {
  const token = await ensureFreshToken(
    store,
    'xero',
    (rt) => refreshXeroToken(rt, creds),
    entityId,
  );
  if (!token.tenantId) {
    throw new Error('Xero token is missing tenantId');
  }
  return pushDraftInvoiceToXero({
    ...invoice,
    tenantId: token.tenantId,
    accessToken: token.accessToken,
  });
}
