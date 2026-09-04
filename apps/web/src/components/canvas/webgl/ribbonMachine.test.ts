import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { ribbonMachine, widthFromState } from "./ribbonMachine";

describe("ribbonMachine", () => {
  it("starts collapsed", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe("collapsed");
    expect(widthFromState(actor.getSnapshot().value as string)).toBe("collapsed");
    actor.stop();
  });

  it("forces rail on PEN_DOWN and returns to collapsed on PEN_UP", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "PEN_DOWN" });
    expect(actor.getSnapshot().value).toBe("rail");
    expect(widthFromState(actor.getSnapshot().value as string)).toBe("rail");
    actor.send({ type: "PEN_UP" });
    expect(actor.getSnapshot().value).toBe("collapsed");
    actor.stop();
  });

  it("re-enters rail from rail (pen-down signal repeats every stroke)", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "PEN_DOWN" });
    actor.send({ type: "PEN_DOWN" });
    expect(actor.getSnapshot().value).toBe("rail");
    actor.stop();
  });

  it("never has an intermediate state — binary only", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    // Rapid fire events — the machine must always be in exactly one state
    actor.send({ type: "PEN_DOWN" });
    actor.send({ type: "PEN_UP" });
    actor.send({ type: "PEN_DOWN" });
    actor.send({ type: "PEN_UP" });
    const state = actor.getSnapshot().value;
    expect(["collapsed", "rail"]).toContain(state);
    actor.stop();
  });
});
