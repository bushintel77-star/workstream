import { describe, expect, it } from "vitest";
import { applySheetTemplate } from "@workstream/domain";
import { presentationPackPersistKey } from "./useStudioState";

describe("presentationPackPersistKey", () => {
  it("is empty for a missing pack", () => {
    expect(presentationPackPersistKey(null)).toBe("");
    expect(presentationPackPersistKey(undefined)).toBe("");
  });

  it("changes when theme, pen, atmosphere, or widgets change", () => {
    const a = applySheetTemplate("curtis-client-brochure");
    const b = { ...a, theme: "blush" as const };
    const c = { ...a, pen: "technical" as const };
    const d = { ...a, atmosphere: "sage" as const };
    expect(presentationPackPersistKey(a)).not.toBe(
      presentationPackPersistKey(b),
    );
    expect(presentationPackPersistKey(a)).not.toBe(
      presentationPackPersistKey(c),
    );
    expect(presentationPackPersistKey(a)).not.toBe(
      presentationPackPersistKey(d),
    );
    expect(presentationPackPersistKey(a)).toBe(
      presentationPackPersistKey({ ...a }),
    );
  });
});
