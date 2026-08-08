import { describe, expect, it } from "vitest";
import {
  CreateShareRevisionInputSchema,
  PublicSharePayloadSchema,
  ShareDecisionInputSchema,
  ShareRevisionSchema,
  nextShareRevisionLetter,
  shareSnapshotFingerprint,
} from "../index";

const UUID = "00000000-0000-0000-0000-000000000000";
const ISO = "2026-07-23T01:00:00.000Z";
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"; // 43 chars

const snapshot = {
  canvas: null,
  quoteLines: [
    {
      id: "line-1",
      label: "Mass-planted Lomandra",
      unit: "m2",
      qty: 12,
      total: 1800,
    },
  ],
  totalInclGst: 1980,
  address: "22 Smith St, Carlton VIC 3053",
};

describe("ShareRevisionSchema", () => {
  it("round-trips a shared revision", () => {
    const row = {
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      revision: "A",
      token: TOKEN,
      status: "shared" as const,
      created_at: ISO,
      snapshot,
    };
    const parsed = ShareRevisionSchema.safeParse(row);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.revision).toBe("A");
      expect(parsed.data.status).toBe("shared");
      expect(parsed.data.decision).toBeUndefined();
    }
  });

  it("round-trips an accepted decision transition", () => {
    const row = {
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      revision: "B",
      token: TOKEN,
      status: "accepted" as const,
      created_at: ISO,
      snapshot,
      decision: {
        kind: "accepted" as const,
        clientName: "Alex Client",
        decidedAt: "2026-07-23T02:00:00.000Z",
      },
    };
    const parsed = ShareRevisionSchema.safeParse(row);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("accepted");
      expect(parsed.data.decision?.kind).toBe("accepted");
      expect(parsed.data.decision?.clientName).toBe("Alex Client");
    }
  });

  it("round-trips a declined decision with note", () => {
    const row = {
      id: UUID,
      project_id: UUID,
      owner_id: "dev-user",
      revision: "A",
      token: TOKEN,
      status: "declined" as const,
      created_at: ISO,
      snapshot,
      decision: {
        kind: "declined" as const,
        clientName: "Sam Neighbour",
        note: "Budget too high this quarter",
        decidedAt: "2026-07-23T03:00:00.000Z",
      },
    };
    const ok = ShareRevisionSchema.safeParse(row);
    expect(ok.success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(
      ShareRevisionSchema.safeParse({
        id: UUID,
        project_id: UUID,
        owner_id: "dev-user",
        revision: "A",
        token: TOKEN,
        status: "pending",
        created_at: ISO,
        snapshot,
      }).success,
    ).toBe(false);
  });

  it("rejects short tokens", () => {
    expect(
      ShareRevisionSchema.safeParse({
        id: UUID,
        project_id: UUID,
        owner_id: "dev-user",
        revision: "A",
        token: "tooshort",
        status: "shared",
        created_at: ISO,
        snapshot,
      }).success,
    ).toBe(false);
  });
});

describe("ShareDecisionInputSchema", () => {
  it("requires clientName 2–80 chars", () => {
    expect(
      ShareDecisionInputSchema.safeParse({
        kind: "accepted",
        clientName: "A",
      }).success,
    ).toBe(false);
    expect(
      ShareDecisionInputSchema.safeParse({
        kind: "accepted",
        clientName: "  Jo  ",
      }).success,
    ).toBe(true);
    expect(
      ShareDecisionInputSchema.safeParse({
        kind: "declined",
        clientName: "Alex Client",
        note: "Not ready",
      }).success,
    ).toBe(true);
  });
});

describe("CreateShareRevisionInputSchema", () => {
  it("requires at least one quote line and positive total", () => {
    expect(
      CreateShareRevisionInputSchema.safeParse({
        quoteLines: [],
        totalInclGst: 100,
      }).success,
    ).toBe(false);
    expect(
      CreateShareRevisionInputSchema.safeParse({
        quoteLines: snapshot.quoteLines,
        totalInclGst: 0,
      }).success,
    ).toBe(false);
    expect(
      CreateShareRevisionInputSchema.safeParse({
        quoteLines: snapshot.quoteLines,
        totalInclGst: 1980,
      }).success,
    ).toBe(true);
  });

  it("accepts a frozen QuoteDoc share payload (margined line totals)", () => {
    expect(
      CreateShareRevisionInputSchema.safeParse({
        quoteLines: [
          {
            id: "prim-pave",
            label: "Bluestone paving",
            unit: "m2",
            qty: 10,
            total: 3520,
          },
        ],
        totalInclGst: 3872,
      }).success,
    ).toBe(true);
  });
});

describe("PublicSharePayloadSchema", () => {
  it("never exposes superseded as a public status", () => {
    expect(
      PublicSharePayloadSchema.safeParse({
        revision: "A",
        status: "superseded",
        created_at: ISO,
        snapshot,
      }).success,
    ).toBe(false);
  });
});

describe("share helpers", () => {
  it("increments revision letters", () => {
    expect(nextShareRevisionLetter(0)).toBe("A");
    expect(nextShareRevisionLetter(1)).toBe("B");
    expect(nextShareRevisionLetter(25)).toBe("Z");
    expect(nextShareRevisionLetter(26)).toBe("AA");
  });

  it("fingerprints identical snapshots the same way", () => {
    const a = shareSnapshotFingerprint(snapshot);
    const b = shareSnapshotFingerprint({ ...snapshot });
    expect(a).toBe(b);
    expect(
      shareSnapshotFingerprint({
        ...snapshot,
        totalInclGst: 1990,
      }),
    ).not.toBe(a);
  });
});
