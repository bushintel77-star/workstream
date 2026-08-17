import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Perf gate — the WebGL studio's camera pan must produce ZERO React commits.
 *
 * The camera rig lives in the transient store (`liveRig`): StudioControls
 * writes it via `getState().setLiveRig` during a drag and FusedCamera reads
 * it via `getState()` in useFrame — a pan drag never re-renders React.
 *
 * This is the tripwire for the roadmap's "last per-frame React write": if a
 * pan drag starts calling setState per pointer-move (the old `setRig` in
 * WebGLStudioPreview), the commit counter jumps and this gate fails.
 *
 * Mechanism: install a React DevTools hook via addInitScript (before React
 * loads) that counts `onCommitFiberRoot` calls. Reset the counter, drag-pan,
 * then assert it's still 0.
 */
test.describe("WebGL pan perf gate (zero React commits during drag)", () => {
  test("a pan drag produces zero React commits", async ({ page, request }) => {
    // Install the commit counter BEFORE any React module evaluates.
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

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(4000); // dynamic import + R3F canvas mount
    const canvas = page.locator('[data-testid="webgl-studio"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Let hydration / initial autosave settle so background commits don't
    // pollute the measured window.
    await page.waitForTimeout(1500);

    // Sanity: the hook must be counting — the page mount produced commits.
    // This makes the gate non-vacuous (a broken hook would read 0 and pass
    // falsely).
    const mountCommits = await page.evaluate(
      () =>
        ((window as unknown as Record<string, unknown>).__reactCommits as number) ?? 0,
    );
    expect(
      mountCommits,
      "Hook did not count React commits — the gate would be vacuous. " +
        "The DevTools hook failed to install before React loaded.",
    ).toBeGreaterThan(0);

    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Reset the counter, then drag-pan with several pointer moves.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__reactCommits = 0;
    });
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 120, cy + 60, { steps: 8 });
    await page.mouse.up();

    // Allow any queued commits to flush (React scheduler is async).
    await page.waitForTimeout(300);

    const commits = await page.evaluate(
      () =>
        ((window as unknown as Record<string, unknown>).__reactCommits as number) ?? 0,
    );
    expect(
      commits,
      `Pan drag caused ${commits} React commit(s) — the camera is writing React state per frame.`,
    ).toBe(0);

    // No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
