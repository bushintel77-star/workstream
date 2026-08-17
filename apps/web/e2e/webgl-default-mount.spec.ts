import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Regression: operator opens /projects/[id] with no mode override (default
 * survey mode on a survey_review project) and the studio must not land on
 * the "The drawing hit an error." boundary.
 *
 * Root cause this guards: drei <Environment preset> fetched its HDR from
 * raw.githubusercontent.com at runtime — a GitHub 429 threw inside the R3F
 * render and took the whole canvas down. The HDR is now vendored locally
 * and wrapped in an inner boundary that degrades to direct lights.
 */
test.describe("Studio default mount (no ?webgl / no ?mode)", () => {
  test("survey_review project renders without fatal errors", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 400));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 400)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "3 Default Mount Regression, Melbourne VIC 3000",
    });

    await page.goto(`/projects/${projectId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);

    const boundary = page.getByText("The drawing hit an error.");
    expect(
      await boundary.count(),
      `Error boundary rendered.\nCaptured errors:\n${errors.join("\n")}`,
    ).toBe(0);

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError") ||
        e.includes("Uncaught Error"),
    );
    expect(
      fatal,
      `Fatal client errors:\n${fatal.join("\n")}`,
    ).toHaveLength(0);
  });
});
