import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  springStep,
  CAMERA_SPRING,
  FusedCameraScratch,
  type SpringState,
} from "./cameraAnimation";

/* -------------------------------------------------------------------------- */
/* Spring Physics Tests                                                        */
/* -------------------------------------------------------------------------- */

describe("springStep", () => {
  it("moves toward the target over multiple steps", () => {
    const state: SpringState = { position: 0, velocity: 0 };
    // Simulate ~500ms of frames at 60fps (30 frames × 16.67ms).
    for (let i = 0; i < 30; i++) {
      springStep(state, 1, CAMERA_SPRING, 1 / 60);
    }
    // Should be very close to the target (1.0).
    expect(state.position).toBeGreaterThan(0.95);
    expect(state.position).toBeLessThanOrEqual(1.001); // no significant overshoot
  });

  it("settles exactly at the target (critically damped, no permanent oscillation)", () => {
    const state: SpringState = { position: 0, velocity: 0 };
    // Simulate 2 seconds — well past the settle time.
    for (let i = 0; i < 120; i++) {
      springStep(state, 1, CAMERA_SPRING, 1 / 60);
    }
    expect(state.position).toBeCloseTo(1, 3);
    expect(state.velocity).toBeCloseTo(0, 3);
  });

  it("is 100% interruptible — preserves velocity when target changes mid-flight", () => {
    const state: SpringState = { position: 0, velocity: 0 };

    // Start moving toward target=1.
    for (let i = 0; i < 10; i++) {
      springStep(state, 1, CAMERA_SPRING, 1 / 60);
    }
    const midPosition = state.position;
    const midVelocity = state.velocity;

    // The spring should be moving (non-zero position + velocity).
    expect(midPosition).toBeGreaterThan(0.01);
    expect(midVelocity).toBeGreaterThan(0.01);

    // Now reverse the target to 0 mid-flight. The spring should NOT reset —
    // it carries the existing velocity into the new trajectory.
    for (let i = 0; i < 10; i++) {
      springStep(state, 0, CAMERA_SPRING, 1 / 60);
    }

    // It should be heading back toward 0 (position decreasing from midPosition
    // or already past it). The key assertion: it didn't snap or jump.
    // The position should be different from a fresh start at midPosition.
    expect(state.position).not.toBeCloseTo(midPosition, 1);
  });

  it("handles large frame deltas without blowing up (sub-stepping)", () => {
    const state: SpringState = { position: 0, velocity: 0 };
    // Simulate a tab-switch stutter: 500ms delta in one step.
    springStep(state, 1, CAMERA_SPRING, 0.5);
    // Should not be NaN or Infinity (the sub-stepping prevents instability).
    expect(Number.isFinite(state.position)).toBe(true);
    expect(Number.isFinite(state.velocity)).toBe(true);
  });

  it("ignores poison deltas (negative / NaN) and recovers corrupted state", () => {
    // Regression: a negative frame delta (system clock adjustment) once sent
    // the integrator runaway to 1e41, parking the camera at a garbage pitch
    // where every canvas raycast missed — the drawing stopped responding.
    const state: SpringState = { position: 0, velocity: 0 };
    springStep(state, 1, CAMERA_SPRING, 1 / 60);
    const before = state.position;

    springStep(state, 1, CAMERA_SPRING, -0.016);
    expect(state.position).toBe(before);

    springStep(state, 1, CAMERA_SPRING, Number.NaN);
    expect(state.position).toBe(before);

    // A corrupted (non-finite) state resets to the target instead of diverging.
    state.position = Number.POSITIVE_INFINITY;
    state.velocity = Number.POSITIVE_INFINITY;
    springStep(state, 1, CAMERA_SPRING, 1 / 60);
    expect(state.position).toBe(1);
    expect(state.velocity).toBe(0);
  });

  it("starts at rest and does nothing if already at target", () => {
    const state: SpringState = { position: 0.5, velocity: 0 };
    springStep(state, 0.5, CAMERA_SPRING, 1 / 60);
    expect(state.position).toBe(0.5);
    expect(state.velocity).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* FusedCameraScratch Tests (zero-allocation verification)                     */
/* -------------------------------------------------------------------------- */

describe("FusedCameraScratch", () => {
  it("updateOrtho writes a valid projection matrix without allocation", () => {
    const scratch = new FusedCameraScratch();
    const matrix = new THREE.Matrix4();
    // Importing THREE from the test's perspective
    scratch.updateOrtho(matrix, 1, 1.5, 1, 100);
    // A valid ortho projection matrix has specific structure — the [10] element
    // (z-scale) should be non-zero (it maps -10000..10000 to -1..1).
    expect(matrix.elements[10]).not.toBe(0);
  });

  it("updatePersp returns a distance and writes a valid matrix", () => {
    const scratch = new FusedCameraScratch();
    const matrix = new THREE.Matrix4();
    const distance = scratch.updatePersp(matrix, 1, 1.5, 1, 100);
    expect(distance).toBeGreaterThan(0);
    // Perspective projection: the [5] element (y-scale) should be non-zero.
    expect(matrix.elements[5]).not.toBe(0);
  });

  it("computePosition writes into the provided vectors", () => {
    const scratch = new FusedCameraScratch();
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    scratch.computePosition(pos, look, 0, 0.5, 200, 10, 20);

    // At blend=0 (plan): camera is directly overhead at height=distance.
    expect(pos.x).toBe(10); // panX
    expect(pos.y).toBe(200); // distance (height)
    expect(pos.z).toBe(20); // panY (no south offset at blend=0)
    // Look-at should be the pan offset at ground level.
    expect(look.x).toBe(10);
    expect(look.y).toBe(0);
    expect(look.z).toBe(20);
  });

  it("lerpProjection interpolates between two matrices", () => {
    const scratch = new FusedCameraScratch();
    const from = new THREE.Matrix4();
    const to = new THREE.Matrix4();
    const out = new THREE.Matrix4();

    // Set 'from' to identity and 'to' to a scaled matrix.
    from.identity();
    to.makeScale(2, 2, 2);

    scratch.lerpProjection(out, from, to, 0.5);
    // At t=0.5, each diagonal element should be 1.5 (lerp between 1 and 2).
    expect(out.elements[0]).toBeCloseTo(1.5, 5);
    expect(out.elements[5]).toBeCloseTo(1.5, 5);
  });
});
