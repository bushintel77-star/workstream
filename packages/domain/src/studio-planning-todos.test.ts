import { describe, expect, it } from "vitest";
import type { Task } from "@workstream/contracts";
import {
  assessPlanningFromStudio,
  diffDesignTodos,
  encodeDesignTodoSpec,
  parseDesignTodoTrigger,
  planningToDesignTodos,
  promptableDesignTodos,
} from "./studio-planning-todos";

describe("assessPlanningFromStudio", () => {
  it("flags Stonnington stormwater when hardscape is large", () => {
    const flags = assessPlanningFromStudio({
      address: "12 Malvern Rd, Malvern VIC",
      outdoorM2: 200,
      items: [
        {
          id: "p1",
          t: "paving",
          x: 40,
          y: 50,
          scale: 2.5,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    expect(flags.some((f) => f.id === "stonnington-stormwater")).toBe(true);
    expect(flags.some((f) => f.id === "council-stonnington")).toBe(true);
  });

  it("flags TRP when existing trees are on plan", () => {
    const flags = assessPlanningFromStudio({
      address: "1 Test St, Prahran VIC",
      outdoorM2: 180,
      items: [{ id: "e1", t: "exist", x: 30, y: 40, scale: 1 }],
    });
    const trp = flags.find((f) => f.id === "trp-existing");
    expect(trp?.severity).toBe("likely");
  });
});

describe("planningToDesignTodos + diff", () => {
  it("encodes and parses trigger ids", () => {
    const spec = encodeDesignTodoSpec("trp-existing", "detail here");
    expect(parseDesignTodoTrigger(spec)).toBe("trp-existing");
  });

  it("creates only missing design todos and cancels stale pending", () => {
    const flags = assessPlanningFromStudio({
      address: "5 High St, Armadale VIC",
      outdoorM2: 220,
      items: [
        { id: "e1", t: "exist", x: 20, y: 30, scale: 1 },
        {
          id: "p1",
          t: "paving",
          x: 40,
          y: 50,
          scale: 3,
          areaKind: "rect",
          wPx: 110,
          hPx: 80,
        },
      ],
    });
    const proposed = planningToDesignTodos(flags, [
      {
        id: "a1",
        severity: "critical",
        code: "permeability",
        title: "Permeability below target",
        detail: "Add softscape",
        sourceIds: [],
      },
    ]);
    expect(promptableDesignTodos(proposed).length).toBeGreaterThan(0);

    const existing: Task[] = [
      {
        id: "t-old",
        project_id: "p1",
        title: "Old flag",
        assignee_name: null,
        priority: "medium",
        technical_specifications: encodeDesignTodoSpec(
          "stormwater-review",
          "gone",
        ),
        status: "pending",
        source: "design",
        created_at: new Date().toISOString(),
      },
    ];
    const diff = diffDesignTodos(existing, proposed);
    expect(diff.toCancelIds).toContain("t-old");
    expect(diff.toCreate.some((c) => c.trigger_id === "trp-existing")).toBe(
      true,
    );
    expect(diff.toCreate.every((c) => c.source === "design")).toBe(true);
  });
});
