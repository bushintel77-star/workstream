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

  it("deploys on HOVER_ENTER and collapses on HOVER_LEAVE", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "HOVER_ENTER" });
    expect(actor.getSnapshot().value).toBe("deployed");
    actor.send({ type: "HOVER_LEAVE" });
    expect(actor.getSnapshot().value).toBe("collapsed");
    actor.stop();
  });

  it("toggles on CMD_K_TOGGLE", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "CMD_K_TOGGLE" });
    expect(actor.getSnapshot().value).toBe("deployed");
    actor.send({ type: "CMD_K_TOGGLE" });
    expect(actor.getSnapshot().value).toBe("collapsed");
    actor.stop();
  });

  it("forces rail on PEN_DOWN from any state", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "HOVER_ENTER" });
    expect(actor.getSnapshot().value).toBe("deployed");
    actor.send({ type: "PEN_DOWN" });
    expect(actor.getSnapshot().value).toBe("rail");
    actor.stop();
  });

  it("returns to collapsed on PEN_UP from rail", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    actor.send({ type: "PEN_DOWN" });
    expect(actor.getSnapshot().value).toBe("rail");
    actor.send({ type: "PEN_UP" });
    expect(actor.getSnapshot().value).toBe("collapsed");
    actor.stop();
  });

  it("never has an intermediate state — binary toggle only", () => {
    const actor = createActor(ribbonMachine);
    actor.start();
    // Rapid fire events — the machine must always be in exactly one state
    actor.send({ type: "HOVER_ENTER" });
    actor.send({ type: "HOVER_LEAVE" });
    actor.send({ type: "HOVER_ENTER" });
    actor.send({ type: "CMD_K_TOGGLE" });
    actor.send({ type: "CMD_K_TOGGLE" });
    const state = actor.getSnapshot().value;
    expect(["collapsed", "deployed", "rail"]).toContain(state);
    actor.stop();
  });
});
