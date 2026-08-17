import { describe, expect, it, vi } from "vitest";
import { createRafCoalescer } from "./useRafCoalesced";

/** Deterministic rAF stand-in — the test flushes queued callbacks manually. */
function makeScheduler() {
  const queue = new Map<number, () => void>();
  let nextId = 1;
  const schedule = (cb: () => void) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  const cancel = (id: number) => {
    queue.delete(id);
  };
  const flush = () => {
    const pending = [...queue.values()];
    queue.clear();
    pending.forEach((cb) => cb());
  };
  return { schedule, cancel, flush };
}

describe("createRafCoalescer", () => {
  it("delivers one call per frame with the last value of that frame", () => {
    const { schedule, flush } = makeScheduler();
    const fn = vi.fn();
    const c = createRafCoalescer(fn, schedule, () => {});

    c.call(1);
    c.call(2);
    c.call(3); // many pointer events within the same frame

    expect(fn).not.toHaveBeenCalled(); // not flushed yet
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3); // last value wins

    // Next frame delivers the next batch.
    c.call(4);
    flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(4);
  });

  it("does not schedule a new frame while one is already pending", () => {
    const { schedule, flush } = makeScheduler();
    const scheduleSpy = vi.fn(schedule);
    const fn = vi.fn();
    const c = createRafCoalescer(fn, scheduleSpy, () => {});

    c.call("a");
    c.call("b");
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel drops a pending delivery and later calls still work", () => {
    const { schedule, cancel, flush } = makeScheduler();
    const fn = vi.fn();
    const c = createRafCoalescer(fn, schedule, cancel);

    c.call("x");
    c.cancel();
    flush();
    expect(fn).not.toHaveBeenCalled(); // dropped

    c.call("y");
    flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("y");
  });

  it("keeps the latest fn reference across calls", () => {
    const { schedule, flush } = makeScheduler();
    let current: (v: number) => void = () => {};
    const c = createRafCoalescer((v: number) => current(v), schedule, () => {});

    current = vi.fn();
    c.call(7);
    flush();
    expect(current).toHaveBeenCalledWith(7);
  });
});
