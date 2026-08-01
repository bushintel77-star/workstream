"use client";

import type { StudioEstimateReport } from "@workstream/domain";
import { QuoteBuilder } from "../quote/QuoteBuilder";

type Props = {
  /** Project create address — not the studio seed site label (defaults Wrights). */
  address: string;
  estimate: StudioEstimateReport;
  estimateSettling?: boolean;
  onShare?: (payload: {
    quoteLines: Array<{
      id: string;
      label: string;
      unit: string;
      qty: number;
      total: number;
    }>;
    totalInclGst: number;
  }) => void;
  onBack: () => void;
  onOpenLibrary?: () => void;
  onFit?: () => void;
};

/**
 * Quote lens — editable builder over the live preemptive BOM (override layer).
 */
export function QuoteSurface(props: Props) {
  return <QuoteBuilder {...props} />;
}
