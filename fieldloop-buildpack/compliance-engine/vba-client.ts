// FieldLoop v0.1 — compliance-engine/vba-client.ts
// VBA360 lodgement adapter.
//
// HONESTY NOTE: VBA360 does not currently offer a confirmed, documented public
// REST API. This module therefore defines a client interface plus:
//   1. a clearly-marked stub (records the lodgement request), and
//   2. a manual-lodge fallback (generates a PDF package and notifies the office
//      to lodge on VBA360).
// The implementation MUST NOT fabricate a VBA360 endpoint. If a live API is confirmed later,
// implement the same interface with the real transport behind it.

export interface VbaCertificateInput {
  jobId: string;
  picLicence: string; // e.g. 118492
  coesNumber?: string;
  workClass: string[];
  jobValueIncGst: number;
  gasTest?: Record<string, unknown>;
  declaration: string;
}

export interface VbaLodgeResult {
  status: 'lodged' | 'manual_pending' | 'error';
  vbaRef?: string;
  message: string;
}

export interface VbaComplianceClient {
  lodgeCertificate(input: VbaCertificateInput): Promise<VbaLodgeResult>;
}

/**
 * Stub transport: acknowledges the request without contacting VBA. Used for
 * development and until live API credentials/access are confirmed.
 */
export class StubVbaClient implements VbaComplianceClient {
  async lodgeCertificate(input: VbaCertificateInput): Promise<VbaLodgeResult> {
    return {
      status: 'lodged',
      vbaRef: `STUB-${input.jobId.slice(0, 8)}`,
      message: 'Stub lodgement recorded (no VBA360 API configured)',
    };
  }
}

/**
 * Manual-lodge fallback: mark the certificate pending and flag the office to
 * lodge it on VBA360 within the 5-day window. The PDF package generation and
 * office notification are triggered by the caller (API layer).
 */
export class ManualLodgeVbaClient implements VbaComplianceClient {
  async lodgeCertificate(input: VbaCertificateInput): Promise<VbaLodgeResult> {
    return {
      status: 'manual_pending',
      message: 'Manual lodgement flagged: generate PDF package and lodge on VBA360',
    };
  }
}

/**
 * Resolve the client to use from env. Defaults to the manual-lodge fallback so
 * the system is honest and safe when no live VBA360 integration exists.
 */
export function resolveVbaClient(): VbaComplianceClient {
  if (process.env.VBA360_MODE === 'stub') return new StubVbaClient();
  return new ManualLodgeVbaClient();
}
