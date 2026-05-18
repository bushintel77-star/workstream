const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchPortalQuote(token: string): Promise<{
  project: { id: string; address: string; created_at: string };
  survey: {
    lot_area_m2: number;
    house_area_m2: number;
    garden_area_m2: number;
  } | null;
  design: {
    rationale: string;
    proposal: {
      zones: Array<{ id: string; name: string; treatment: string }>;
    };
  } | null;
  costing: {
    scenario: string;
    subtotal: number;
    gst: number;
    total: number;
    line_items: Array<{
      label: string;
      qty: number;
      unit: string;
      rate: number;
      total: number;
      is_provisional: boolean;
    }>;
  } | null;
} | { error: string }> {
  const res = await fetch(`${API_URL}/portal/quote/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: `Portal returned ${res.status}` };
  }
  return res.json();
}

export async function createDepositCheckout(token: string): Promise<{
  session?: {
    session_id: string;
    checkout_url: string;
    deposit_amount_aud: number;
    mode: "live" | "dev_fallback";
  };
  error?: string;
}> {
  const res = await fetch(`${API_URL}/portal/deposit/${token}`, {
    method: "POST",
    cache: "no-store",
  });
  if (!res.ok) {
    return { error: `Portal returned ${res.status}` };
  }
  return res.json();
}
