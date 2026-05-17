export type CostScenario = 'lean' | 'standard' | 'buffer';

export const CONTINGENCY_RATES = {
  lean: 0.03,
  standard: 0.05,
  buffer: 0.08,
} as const;

export function calculateLineTotal(qty: number, rate: number): number {
  return Math.round(qty * rate * 100) / 100;
}

export function calculateSubtotal(lineTotals: number[]): number {
  return lineTotals.reduce((sum, v) => sum + v, 0);
}

export function calculateGST(subtotal: number): number {
  return subtotal * 0.1;
}

export function calculateTotal(subtotal: number, gst: number): number {
  return subtotal + gst;
}

export function applyContingency(
  subtotal: number,
  scenario: CostScenario,
): number {
  return subtotal * CONTINGENCY_RATES[scenario];
}
