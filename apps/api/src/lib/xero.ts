/**
 * Xero parallel integration. Sister to apps/api/src/lib/myob.ts; same dev-
 * fallback pattern, same Construct↔accounting entity mapping. Curtis & Co
 * picks one (MYOB or Xero) at deploy time; both can be configured but the
 * UI currently prefers MYOB if both are connected.
 *
 * Live mode requires:
 *   XERO_ACCESS_TOKEN — short-lived (30min) OAuth2 access token
 *   XERO_TENANT_ID    — the connected organisation's tenant id
 * Refresh-token rotation is the deploy-side responsibility (not handled
 * here yet) — same shape as MYOB.
 */

import type {
  Costing,
  Project,
  XeroContact,
  XeroItem,
} from "@construct/contracts";

const XERO_API = "https://api.xero.com/api.xro/2.0";

const DEV_CONTACTS: XeroContact[] = [
  {
    contact_id: "dev-xc-armadale",
    name: "Eleanor Marsh",
    email_address: "eleanor@example.com.au",
    phone: "+61 3 9510 0001",
  },
  {
    contact_id: "dev-xc-prahran",
    name: "James Whitford",
    email_address: "james.whitford@example.com.au",
    phone: "+61 3 9510 0002",
  },
];

const DEV_ITEMS: XeroItem[] = [
  { item_id: "dev-xi-1", code: "PLT-CARP-PL24", name: "Pleached hornbeam 2.4m std", sales_unit_price: 480, unit_of_measure: "ea" },
  { item_id: "dev-xi-2", code: "PAV-BLUE-SAWN", name: "Bluestone paving, sawn", sales_unit_price: 120, unit_of_measure: "m2" },
  { item_id: "dev-xi-3", code: "IRR-DRIP", name: "Drip line 13mm w/ emitters", sales_unit_price: 4, unit_of_measure: "lm" },
];

export function isXeroLive(): boolean {
  return !!process.env.XERO_ACCESS_TOKEN && !!process.env.XERO_TENANT_ID;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.XERO_ACCESS_TOKEN}`,
    "Xero-tenant-id": process.env.XERO_TENANT_ID ?? "",
    accept: "application/json",
  };
}

export async function listContacts(): Promise<XeroContact[]> {
  if (!isXeroLive()) return DEV_CONTACTS;
  const res = await fetch(`${XERO_API}/Contacts`, { headers: headers() });
  if (!res.ok) throw new Error(`Xero Contacts ${res.status}`);
  const json = (await res.json()) as {
    Contacts: Array<{
      ContactID: string;
      Name: string;
      EmailAddress?: string | null;
      Phones?: Array<{ PhoneNumber?: string | null }>;
    }>;
  };
  return json.Contacts.map((c) => ({
    contact_id: c.ContactID,
    name: c.Name,
    email_address: c.EmailAddress ?? null,
    phone: c.Phones?.[0]?.PhoneNumber ?? null,
  }));
}

export async function listItems(): Promise<XeroItem[]> {
  if (!isXeroLive()) return DEV_ITEMS;
  const res = await fetch(`${XERO_API}/Items`, { headers: headers() });
  if (!res.ok) throw new Error(`Xero Items ${res.status}`);
  const json = (await res.json()) as {
    Items: Array<{
      ItemID: string;
      Code: string;
      Name: string;
      SalesDetails?: { UnitPrice?: number; UnitOfMeasure?: string };
    }>;
  };
  return json.Items.map((i) => ({
    item_id: i.ItemID,
    code: i.Code,
    name: i.Name,
    sales_unit_price: i.SalesDetails?.UnitPrice ?? 0,
    unit_of_measure: i.SalesDetails?.UnitOfMeasure ?? null,
  }));
}

export type XeroDraftInvoiceArgs = {
  project: Project;
  contactId: string;
  costing: Costing;
};

export type XeroDraftInvoiceResult = {
  invoice_id: string;
  invoice_number: string;
  mode: "live" | "dev_fallback";
  total_incl_gst: number;
};

export async function draftInvoiceFromCosting(
  args: XeroDraftInvoiceArgs,
): Promise<XeroDraftInvoiceResult> {
  if (!isXeroLive()) {
    return {
      invoice_id: `dev-xinv-${Date.now()}`,
      invoice_number: `INV-XERO-DEV-${Date.now().toString().slice(-6)}`,
      mode: "dev_fallback",
      total_incl_gst: args.costing.total,
    };
  }

  const body = {
    Type: "ACCREC",
    Contact: { ContactID: args.contactId },
    Date: new Date().toISOString().slice(0, 10),
    Status: "DRAFT",
    Reference: `Construct · ${args.project.address}`,
    LineAmountTypes: "Exclusive",
    LineItems: args.costing.line_items
      .filter((li) => !li.is_provisional)
      .map((li) => ({
        Description: li.label,
        Quantity: li.qty,
        UnitAmount: li.rate,
        TaxType: "OUTPUT",
        AccountCode: process.env.XERO_INCOME_ACCOUNT_CODE ?? "200",
      })),
  };

  const res = await fetch(`${XERO_API}/Invoices`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Xero invoice draft failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    Invoices: Array<{ InvoiceID: string; InvoiceNumber: string }>;
  };
  const inv = json.Invoices[0];
  return {
    invoice_id: inv.InvoiceID,
    invoice_number: inv.InvoiceNumber,
    mode: "live",
    total_incl_gst: args.costing.total,
  };
}
