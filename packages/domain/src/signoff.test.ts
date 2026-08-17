import { describe, expect, it } from "vitest";
import type { BoardDisclaimer, ProjectSignoff } from "@workstream/contracts";
import {
  createSignoffRecord,
  resolveSignoffGate,
  signoffReadiness,
} from "./signoff";

const notice = (
  id: string,
  kind: BoardDisclaimer["kind"],
  required: boolean,
): BoardDisclaimer => ({
  id,
  kind,
  title: id,
  statement: `${id} statement`,
  trigger: "board geometry",
  required,
  cites: [],
  basis: "operator",
});

const disclaimers = [
  notice("subsurface", "subsurface", true),
  notice("maturity", "maturity", true),
  notice("barrier", "safety_waiver", true),
];

const existing = (over: Partial<ProjectSignoff> = {}): ProjectSignoff => ({
  id: "00000000-0000-0000-0000-000000000001",
  project_id: "00000000-0000-0000-0000-000000000002",
  status: "pending",
  revision: null,
  accepted_notice_ids: [],
  quote_total_incl_gst: 0,
  signed_at: null,
  signed_by: null,
  updated_at: "2026-08-17T00:00:00.000Z",
  ...over,
});

describe("resolveSignoffGate", () => {
  it("hard-confirms only a required safety waiver", () => {
    const gate = resolveSignoffGate(disclaimers, {});
    expect(gate.hardConfirm?.id).toBe("barrier");
    expect(gate.softOutstanding).toBe(2);
  });

  it("acknowledging notices clears them", () => {
    const gate = resolveSignoffGate(disclaimers, {
      subsurface: true,
      maturity: true,
      barrier: true,
    });
    expect(gate.hardConfirm).toBeNull();
    expect(gate.softOutstanding).toBe(0);
  });
});

describe("signoffReadiness", () => {
  it("reports revision, quote and notices missing when nothing is set", () => {
    const r = signoffReadiness({
      disclaimers,
      acknowledged: {},
      revision: null,
      quoteTotalInclGst: null,
      existing: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["revision", "quote", "notices"]);
    expect(r.hard_confirm_notice_id).toBe("barrier");
    expect(r.soft_outstanding).toBe(2);
  });

  it("is ready once revision, quote and all required notices are accepted", () => {
    const r = signoffReadiness({
      disclaimers,
      acknowledged: { subsurface: true, maturity: true, barrier: true },
      revision: "rev-1",
      quoteTotalInclGst: 12500,
      existing: null,
    });
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("stays unready while a required notice is unanswered", () => {
    const r = signoffReadiness({
      disclaimers,
      acknowledged: { subsurface: true, maturity: true },
      revision: "rev-1",
      quoteTotalInclGst: 12500,
      existing: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(["notices"]);
  });

  it("treats an existing signed-off record as immutable and ready", () => {
    const r = signoffReadiness({
      disclaimers,
      acknowledged: {},
      revision: null,
      quoteTotalInclGst: null,
      existing: existing({ status: "signed_off" }),
    });
    expect(r.ready).toBe(true);
    expect(r.signed_off).toBe(true);
    expect(r.missing).toEqual([]);
  });
});

describe("createSignoffRecord", () => {
  it("creates an immutable signed-off record bound to revision + quote", () => {
    const rec = createSignoffRecord({
      projectId: "00000000-0000-0000-0000-000000000002",
      revision: "rev-1",
      quoteTotalInclGst: 12500,
      acceptedNoticeIds: ["subsurface", "maturity", "barrier", "barrier"],
      signedBy: "operator-1",
      now: "2026-08-17T00:00:00.000Z",
    });
    expect(rec.status).toBe("signed_off");
    expect(rec.revision).toBe("rev-1");
    expect(rec.quote_total_incl_gst).toBe(12500);
    expect(rec.signed_by).toBe("operator-1");
    expect(rec.signed_at).toBe("2026-08-17T00:00:00.000Z");
    // Deduped, order preserved.
    expect(rec.accepted_notice_ids).toEqual([
      "subsurface",
      "maturity",
      "barrier",
    ]);
  });

  it("refuses to fabricate a signoff without a revision or quote", () => {
    expect(() =>
      createSignoffRecord({
        projectId: "p",
        revision: "",
        quoteTotalInclGst: 12500,
        acceptedNoticeIds: [],
        signedBy: "op",
      }),
    ).toThrow(/revision/);
    expect(() =>
      createSignoffRecord({
        projectId: "p",
        revision: "rev-1",
        quoteTotalInclGst: 0,
        acceptedNoticeIds: [],
        signedBy: "op",
      }),
    ).toThrow(/quote/);
  });
});
