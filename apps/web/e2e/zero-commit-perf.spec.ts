import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Zero-commit perf gates — the roadmap's "no per-frame React writes" tripwire.
 *
 * Each gate installs a React DevTools hook via addInitScript (before React
 * loads) that counts `onCommitFiberRoot` calls, then asserts the target
 * interaction produces ZERO commits:
 *
 *   1. Handoff DOM board pan — `startBoardPan` writes the `.zoomWorld`
 *      transform straight to the DOM and commits `ui.panX/panY` once on
 *      pointer-up.
 *   2. Handoff DOM wheel-zoom — the wheel handler mutates transform +
 *      transformOrigin directly and commits once on a debounced wheel-end.
 *   3. WebGL split-view linked-camera drag — both halves read the shared
 *      `liveRig` store value in useFrame; a drag never re-renders React.
 *
 * Background-noise handling: the handoff studio's presentation lens flips
 * `fidelity` back to "presentation" ~600ms after the last interaction (a
 * one-shot background commit, not a per-frame write). Each handoff gate warms
 * up first and reads promptly so that flip is excluded from the measured
 * window; if a pan/zoom ever starts calling setUi per pointer-move, the
 * counter jumps and the gate fails.
 */
async function installCommitCounter(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
    const renderers = new Map();
    let nextId = 1;
    (window as unknown as Record<string, unknown>).__reactCommits = 0;
    (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers,
      inject(renderer: unknown) {
        const id = nextId++;
        renderers.set(id, renderer);
        return id;
      },
      // React 19 fires this on every commit; errors inside are caught by React.
      onCommitFiberRoot() {
        (window as unknown as Record<string, unknown>).__reactCommits =
          (((window as unknown as Record<string, unknown>).__reactCommits as number) ??
            0) + 1;
      },
      onPostCommitFiberRoot() {},
      onCommitFiberUnmount() {},
      onScheduleFiberRoot() {},
    };
  });
}

function commitCount(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(
    () =>
      ((window as unknown as Record<string, unknown>).__reactCommits as number) ?? 0,
  );
}

function resetCommits(page: import("@playwright/test").Page): Promise<void> {
  return page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__reactCommits = 0;
  });
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      e.includes("Maximum update depth") ||
      e.includes("TypeError") ||
      e.includes("ReferenceError"),
  );
}

test.describe("Handoff board pan perf gate (zero React commits during drag)", () => {
  test("a middle-drag pan produces zero React commits", async ({
    page,
    request,
  }) => {
    await installCommitCounter(page);
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e: Error) =>
      errors.push(`${e.name}: ${e.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Pan Gate Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?svg=1`, {
      waitUntil: "networkidle",
    });
    const board = page.locator('[data-testid="studio-board"]');
    await expect(board).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="zoom-world"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(1500);

    // Sanity: the hook must be counting — the mount produced commits.
    expect(
      await commitCount(page),
      "Hook did not count React commits — the gate would be vacuous.",
    ).toBeGreaterThan(0);

    const box = (await board.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Warm up: one burst, then wait past the presentation-lens idle flip
    // (600 ms) + one-shot hint timers so the measured window is quiet.
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(cx + 5, cy);
    await page.mouse.up({ button: "middle" });
    await page.waitForTimeout(900);

    // Measured drag: reset after pointer-down (drag-start commit allowed).
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: "middle" });
    await page.waitForTimeout(100);
    await resetCommits(page);

    // Fast drag-pan — several pointer moves in one dispatch. Read promptly so
    // the idle flip (a background fidelity commit) is excluded.
    await page.mouse.move(cx - 120, cy + 60, { steps: 8 });
    await page.waitForTimeout(50);

    const commits = await commitCount(page);
    expect(
      commits,
      `Pan drag caused ${commits} React commit(s) — the board is writing React state per frame.`,
    ).toBe(0);

    await page.mouse.up({ button: "middle" });
    expect(fatalErrors(errors), `Fatal console errors:\n${errors.join("\n")}`).toHaveLength(0);
  });
});

test.describe("Handoff wheel-zoom perf gate (zero React commits during a burst)", () => {
  test("a wheel-zoom burst produces zero React commits", async ({
    page,
    request,
  }) => {
    await installCommitCounter(page);
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e: Error) =>
      errors.push(`${e.name}: ${e.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Wheel Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?svg=1`, {
      waitUntil: "networkidle",
    });
    const board = page.locator('[data-testid="studio-board"]');
    await expect(board).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    expect(
      await commitCount(page),
      "Hook did not count React commits — the gate would be vacuous.",
    ).toBeGreaterThan(0);

    const box = (await board.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    // Warm up: a wheel burst + wait past the 180ms wheel-end debounce and the
    // 600ms idle flip so the measured burst is quiet.
    await page.mouse.wheel(0, -120);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(900);

    // Measured burst. The first wheel is the interaction-START (it flips the
    // presentation-lens fidelity — the same class of start commit as the pan
    // drag's pointer-down); flush it, reset, then measure the remaining bursts.
    await resetCommits(page);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(50);
    await resetCommits(page);
    await page.mouse.wheel(0, -120);
    await page.mouse.wheel(0, -120);
    await page.mouse.wheel(0, -120);
    // Read promptly, before the wheel-end debounced commit (the single allowed
    // interaction-end write) and the idle flip (a background fidelity commit).
    const commits = await commitCount(page);
    expect(
      commits,
      `Wheel-zoom burst caused ${commits} React commit(s) — zoom is writing React state per event.`,
    ).toBe(0);

    // Let the debounced commit land (cleanup).
    await page.waitForTimeout(300);
    expect(fatalErrors(errors), `Fatal console errors:\n${errors.join("\n")}`).toHaveLength(0);
  });
});

test.describe("WebGL split-view linked-camera drag perf gate", () => {
  // Two full WebGL canvases (context + shader compile + EffectComposer)
  // exceed the default budget on cold CI hardware.
  test.setTimeout(240_000);

  test("a linked-camera drag in split view produces zero React commits", async ({
    page,
    request,
  }) => {
    await installCommitCounter(page);
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e: Error) =>
      errors.push(`${e.name}: ${e.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Split Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    const canvas = page.locator('[data-testid="webgl-studio"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Toggle the split lens.
    await page.getByRole("button", { name: "▸ Split" }).click();
    await page.waitForTimeout(4000);
    const halves = page.locator('[data-testid="webgl-studio"]');
    await expect(halves.nth(1)).toBeVisible({ timeout: 15_000 });
    expect(await halves.count()).toBe(2);

    // Sanity: hook is counting.
    expect(
      await commitCount(page),
      "Hook did not count React commits — the gate would be vacuous.",
    ).toBeGreaterThan(0);

    const leftHalf = halves.nth(0);
    const box = (await leftHalf.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Warm up: one drag on the left (locked plan) half, settle.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 30, cy + 15, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // Measured linked drag on the left half — both cameras follow the shared
    // rig. Must be zero commits.
    await resetCommits(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 80, cy + 40, { steps: 6 });
    await page.waitForTimeout(50);
    const commits = await commitCount(page);
    expect(
      commits,
      `Linked split-view drag caused ${commits} React commit(s) — the camera is writing React state per frame.`,
    ).toBe(0);
    await page.mouse.up();

    // Both halves still mounted after the drag.
    expect(await halves.count()).toBe(2);
    await expect(halves.nth(1)).toBeVisible();
    expect(fatalErrors(errors), `Fatal console errors:\n${errors.join("\n")}`).toHaveLength(0);
  });
});
