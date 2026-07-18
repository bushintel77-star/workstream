import { describe, expect, it } from "vitest";
import {
  beginMutation,
  commitPrecise,
  createMutationFsm,
  mutateHeuristic,
  resolveMutation,
} from "./canvas-mutation-fsm";

describe("canvas mutation fsm", () => {
  it("scales cost by area ratio while mutating", () => {
    let s = createMutationFsm(100);
    s = beginMutation(s, 100, 10);
    s = mutateHeuristic(s, 15);
    expect(s.phase).toBe("MUTATING");
    expect(s.optimisticCost).toBe(150);
  });

  it("commits precise cost after resolve", () => {
    let s = createMutationFsm(100);
    s = beginMutation(s, 100, 10);
    s = mutateHeuristic(s, 20);
    s = resolveMutation(s);
    expect(s.phase).toBe("RESOLVED");
    expect(s.pendingPrecise).toBe(true);
    s = commitPrecise(s, 198.5);
    expect(s.phase).toBe("IDLE");
    expect(s.optimisticCost).toBe(198.5);
    expect(s.pendingPrecise).toBe(false);
  });
});
