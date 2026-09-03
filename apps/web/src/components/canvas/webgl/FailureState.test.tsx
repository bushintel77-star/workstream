import { describe, expect, it } from "vitest";
import { FailureState, type FailureKind } from "./FailureState";

/**
 * Phase O — FailureState unit tests.
 *
 * Testing-library/react is not a dependency in this repo, so we test the
 * component's pure logic (kind → label mapping, prop flow) by rendering
 * to a string via React's renderToStaticMarkup. The DOM assertions are
 * kept in the e2e suite.
 */
import { renderToStaticMarkup } from "react-dom/server";

function renderFailure(props: Parameters<typeof FailureState>[0]): string {
  return renderToStaticMarkup(<FailureState {...props} />);
}

describe("FailureState — Phase O: error and empty states", () => {
  it("renders the kind label and title", () => {
    const html = renderFailure({
      kind: "failed-import",
      title: "Overlay fetch failed",
      detail: "BYDA returned 503",
    });
    expect(html).toContain("FAILED IMPORT");
    expect(html).toContain("Overlay fetch failed");
    expect(html).toContain("BYDA returned 503");
  });

  it("shows retry and dismiss buttons when handlers are provided", () => {
    const html = renderFailure({
      kind: "corrupt-underlay",
      title: "Underlay unreadable",
      detail: "Bad geo",
      onRetry: () => {},
      onDismiss: () => {},
    });
    expect(html).toContain("Retry");
    expect(html).toContain("Dismiss");
  });

  it("hides retry and dismiss when no handlers", () => {
    const html = renderFailure({
      kind: "corrupt-underlay",
      title: "Underlay unreadable",
      detail: "Re-upload the photo",
    });
    expect(html).not.toContain("Retry");
    expect(html).not.toContain("Dismiss");
  });

  it("shows source stamp when provided", () => {
    const html = renderFailure({
      kind: "rejected-calibration",
      title: "Calibration rejected",
      detail: "Scale outside tolerance",
      source: "BYDA · fetched 14:02",
    });
    expect(html).toContain("BYDA · fetched 14:02");
  });

  it("has role=alert and aria-live=assertive", () => {
    const html = renderFailure({
      kind: "failed-import",
      title: "Import failed",
      detail: "detail",
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it("sets data-failure-kind", () => {
    const html = renderFailure({
      kind: "corrupt-underlay",
      title: "Underlay unreadable",
      detail: "detail",
    });
    expect(html).toContain('data-failure-kind="corrupt-underlay"');
  });

  it("every canvas failure kind has a label", () => {
    // The empty schedule is drawn by ScheduleSheet on the paper surface, not
    // by this dark-glass card, so it is not a kind here.
    const kinds: FailureKind[] = [
      "failed-import",
      "corrupt-underlay",
      "rejected-calibration",
    ];
    for (const kind of kinds) {
      const html = renderFailure({
        kind,
        title: "test",
        detail: "test",
      });
      expect(html).toContain(kind);
    }
  });
});
