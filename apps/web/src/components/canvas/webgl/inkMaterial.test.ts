/**
 * Dynamic ink shader patches — validated against the ACTUAL three-stdlib
 * LineMaterial shader source so a dependency bump that renames a patch
 * target fails loudly instead of silently corrupting the ink.
 */

import { describe, expect, it } from "vitest";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  INK_FRAGMENT_PATCHES,
  INK_VERTEX_PATCHES,
  NibInkMaterial,
  patchShader,
  StippleMaterial,
} from "./inkMaterial";

describe("patchShader", () => {
  it("replaces a target exactly once", () => {
    expect(patchShader("abc def abc", [["def", "XYZ"]])).toBe("abc XYZ abc");
  });

  it("throws when the target is missing", () => {
    expect(() => patchShader("abc", [["nope", "x"]])).toThrow(/not found/);
  });

  it("throws when the target matches twice", () => {
    expect(() => patchShader("abc abc", [["abc", "x"]])).toThrow(/twice/);
  });
});

describe("ink shader patches against the real three-stdlib LineMaterial", () => {
  it("every vertex patch target exists exactly once and injects aWidth", () => {
    const src = new LineMaterial().vertexShader;
    const patched = patchShader(src, INK_VERTEX_PATCHES);
    expect(patched).toContain("attribute float aWidth;");
    expect(patched).toContain("attribute float aBleed;");
    expect(patched).toContain("varying float vBleed;");
    expect(patched).toContain("offset *= linewidth * aWidth;");
    expect(patched).toContain("float hw = linewidth * aWidth * 0.5;");
  });

  it("every fragment patch target exists exactly once and injects the ink uniforms", () => {
    const src = new LineMaterial().fragmentShader;
    const patched = patchShader(src, INK_FRAGMENT_PATCHES);
    expect(patched).toContain("uniform float uGrain;");
    expect(patched).toContain("uniform float uEdgeSoft;");
    expect(patched).toContain("uniform float uBleed;");
    expect(patched).toContain("varying float vBleed;");
    expect(patched).toContain("edgeFade");
    expect(patched).toContain("grainN");
  });

  it("NibInkMaterial exposes the ink uniform accessors", () => {
    const m = new NibInkMaterial({ grain: 0.5, edgeSoft: 0.2, bleed: 0.1 });
    expect(m.grain).toBe(0.5);
    expect(m.edgeSoft).toBe(0.2);
    expect(m.bleed).toBe(0.1);
    // Its own stored shader sources patch cleanly (fail-fast on drift).
    expect(() => patchShader(m.vertexShader, INK_VERTEX_PATCHES)).not.toThrow();
    expect(() => patchShader(m.fragmentShader, INK_FRAGMENT_PATCHES)).not.toThrow();
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
  });

  it("StippleMaterial carries the stipple uniforms", () => {
    const m = new StippleMaterial({ color: "#8B6F4E", opacity: 0.75 });
    expect(m.uniforms.uColor.value.getStyle()).toBe("rgb(139,111,78)");
    expect(m.uniforms.uOpacity.value).toBe(0.75);
    expect(m.transparent).toBe(true);
  });
});
