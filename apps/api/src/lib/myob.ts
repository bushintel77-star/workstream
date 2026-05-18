/**
 * Minimal MYOB AccountRight / MYOB Business integration.
 *
 * Auth model expected at runtime: OAuth2 client-credentials with a stored
 * access token in MYOB_ACCESS_TOKEN, refresh via MYOB_REFRESH_TOKEN +
 * MYOB_CLIENT_ID / MYOB_CLIENT_SECRET. Company file selected by
 * MYOB_COMPANY_FILE_ID. The token-refresh flow itself isn't implemented
 * here yet — the read calls assume a fresh access token is present.
 *
 * Dev fallback: when MYOB_ACCESS_TOKEN is unset, every call returns
 * deterministic canned data so the full mobile flow runs offline.
 */

import type {
  Costing,
  MyobCustomer,
  MyobItem,
  Project,
} from "@construct/contracts";

const MYOB_BASE = "https://api.myob.com/accountright";

const DEV_CUSTOMERS: MyobCustomer[] = [
  {
    uid: "dev-cust-armadale",
    display_id: "CUST-001",
    company_name: "12 Wattletree Rd Pty Ltd",
    first_name: "Eleanor",
    last_name: "Marsh",
    email: "eleanor@example.com.au",
    phone: "+61 3 9510 0001",
  },
  {
    uid: "dev-cust-prahran",
    display_id: "CUST-002",
    company_name: null,
    first_name: "James",
    last_name: "Whitford",
    email: "james.whitford@example.com.au",
    phone: "+61 3 9510 0002",
  },
  {
    uid: "dev-cust-toorak",
    display_id: "CUST-003",
    company_name: "Glendower Trust",
    first_name: "Priya",
    last_name: "Lal",
    email: "priya@glendower.example",
    phone: "+61 3 9510 0003",
  },
];

const DEV_ITEMS: MyobItem[] = [
  { uid: "dev-itm-1", number: "PLT-CARP-PL24", name: "Pleached hornbeam 2.4m std", base_selling_price: 480, unit_of_measure: "ea" },
  { uid: "dev-itm-2", number: "PLT-LOM-140", name: "Lomandra Tanika 140mm", base_selling_price: 11, unit_of_measure: "ea" },
  { uid: "dev-itm-3", number: "PAV-BLUE-SAWN", name: "Bluestone paving, sawn", base_selling_price: 120, unit_of_measure: "m2" },
  { uid: "dev-itm-4", number: "LGT-UP-BRASS", name: "12V brass spike uplight", base_selling_price: 145, unit_of_measure: "ea" },
  { uid: "dev-itm-5", number: "IRR-DRIP", name: "Drip line, 13mm w/ emitters", base_selling_price: 4, unit_of_measure: "lm" },
  { uid: "dev-itm-6", number: "TSK-PREP", name: "Site prep + setout", base_selling_price: 18, unit_of_measure: "m2" },
];

export function isMyobLive(): boolean {
  return !!process.env.MYOB_ACCESS_TOKEN && !!process.env.MYOB_COMPANY_FILE_ID;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.MYOB_ACCESS_TOKEN}`,
    "x-myobapi-key": process.env.MYOB_CLIENT_ID ?? "",
    "x-myobapi-version": "v2",
    "x-myobapi-cftoken": process.env.MYOB_CFTOKEN ?? "",
    accept: "application/json",
  };
}

function companyFileUrl(path: string): string {
  return `${MYOB_BASE}/${process.env.MYOB_COMPANY_FILE_ID}/${path.replace(/^\//, "")}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`MYOB GET ${url} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function listCustomers(): Promise<MyobCustomer[]> {
  if (!isMyobLive()) return DEV_CUSTOMERS;
  type Response = {
    Items: Array<{
      UID: string;
      DisplayID?: string;
      CompanyName?: string | null;
      FirstName?: string | null;
      LastName?: string | null;
      Addresses?: Array<{ Email?: string | null; Phone1?: string | null }>;
    }>;
  };
  const json = await getJson<Response>(companyFileUrl("Contact/Customer"));
  return json.Items.map((c) => ({
    uid: c.UID,
    display_id: c.DisplayID,
    company_name: c.CompanyName ?? null,
    first_name: c.FirstName ?? null,
    last_name: c.LastName ?? null,
    email: c.Addresses?.[0]?.Email ?? null,
    phone: c.Addresses?.[0]?.Phone1 ?? null,
  }));
}

export async function listItems(): Promise<MyobItem[]> {
  if (!isMyobLive()) return DEV_ITEMS;
  type Response = {
    Items: Array<{
      UID: string;
      Number: string;
      Name: string;
      BaseSellingPrice?: number;
      SellingDetails?: { BaseSellingPrice?: number; UnitOfMeasure?: string };
    }>;
  };
  const json = await getJson<Response>(companyFileUrl("Inventory/Item"));
  return json.Items.map((i) => ({
    uid: i.UID,
    number: i.Number,
    name: i.Name,
    base_selling_price:
      i.BaseSellingPrice ?? i.SellingDetails?.BaseSellingPrice ?? 0,
    unit_of_measure: i.SellingDetails?.UnitOfMeasure ?? null,
  }));
}

export type DraftInvoiceArgs = {
  project: Project;
  customerUid: string;
  costing: Costing;
};

export type DraftInvoiceResult = {
  invoice_uid: string;
  invoice_number: string;
  mode: "live" | "dev_fallback";
  total_incl_gst: number;
};

export async function draftInvoiceFromCosting(
  args: DraftInvoiceArgs,
): Promise<DraftInvoiceResult> {
  if (!isMyobLive()) {
    return {
      invoice_uid: `dev-inv-${Date.now()}`,
      invoice_number: `INV-DEV-${Date.now().toString().slice(-6)}`,
      mode: "dev_fallback",
      total_incl_gst: args.costing.total,
    };
  }

  const body = {
    Date: new Date().toISOString().slice(0, 10),
    Customer: { UID: args.customerUid },
    Status: "Open",
    Comment: `Construct quote · ${args.project.address}`,
    JournalMemo: `Construct ${args.costing.scenario} scenario`,
    Lines: args.costing.line_items
      .filter((li) => !li.is_provisional)
      .map((li) => ({
        Type: "Transaction",
        Description: li.label,
        Total: li.total,
        TaxCode: { Code: "GST" },
        Account: { UID: process.env.MYOB_INCOME_ACCOUNT_UID ?? "" },
      })),
    TotalAmount: args.costing.total,
  };

  const res = await fetch(companyFileUrl("Sale/Invoice/Service"), {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `MYOB invoice draft failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { UID: string; Number: string };
  return {
    invoice_uid: json.UID,
    invoice_number: json.Number,
    mode: "live",
    total_incl_gst: args.costing.total,
  };
}
