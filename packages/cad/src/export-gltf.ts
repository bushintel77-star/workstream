import type { CadDocument, CadEntity } from "@workstream/contracts";

/**
 * Minimal glTF 2.0 JSON (embedded buffer) from a CadDocument.
 *
 * Working-plan proxies only — extruded rings + planting cylinders. Not Nanite,
 * not survey-grade. Honesty string lives on asset.extras / copyright.
 */

type Vec3 = [number, number, number];

const HONESTY = "Working plan metres — confirm on site";

/** CAD (x,y) metres on ground → glTF Y-up (x, height, z). */
function cadToGltf(x: number, y: number, zUp: number): Vec3 {
  return [x, zUp, y];
}

function ringSpanM(points: Array<{ x: number; y: number }>): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function heightForClosedPolyline(
  e: Extract<CadEntity, { kind: "polyline" }>,
  doc: CadDocument,
): number {
  const span = ringSpanM(e.points);
  const boardDiag = Math.hypot(doc.width_m, doc.height_m);
  if (e.layer === "HARDSCAPE") return 0.05;
  if (e.layer === "STRUCTURES") {
    // Large rings ≈ title boundary fence; small ≈ dwelling massing.
    return span > boardDiag * 0.35 ? 0.25 : 3;
  }
  if (e.layer === "WATER") return 0.08;
  return 0.15;
}

class MeshAccum {
  positions: number[] = [];
  indices: number[] = [];

  addTri(a: Vec3, b: Vec3, c: Vec3): void {
    const base = this.positions.length / 3;
    for (const v of [a, b, c]) {
      this.positions.push(v[0], v[1], v[2]);
    }
    this.indices.push(base, base + 1, base + 2);
  }

  addQuad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
    this.addTri(a, b, c);
    this.addTri(a, c, d);
  }

  /** Vertical walls along a closed or open polyline. */
  extrudePolyline(
    points: Array<{ x: number; y: number }>,
    height: number,
    closed: boolean,
  ): void {
    if (points.length < 2 || height <= 0) return;
    const n = points.length;
    const count = closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      const bl = cadToGltf(a.x, a.y, 0);
      const br = cadToGltf(b.x, b.y, 0);
      const tr = cadToGltf(b.x, b.y, height);
      const tl = cadToGltf(a.x, a.y, height);
      this.addQuad(bl, br, tr, tl);
    }
  }

  /** Low prism disc (planting / fixture proxy). */
  addCylinder(
    cx: number,
    cy: number,
    radius: number,
    height: number,
    segments = 10,
  ): void {
    if (radius <= 0 || height <= 0) return;
    const top: Vec3[] = [];
    const bot: Vec3[] = [];
    for (let i = 0; i < segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const x = cx + Math.cos(ang) * radius;
      const y = cy + Math.sin(ang) * radius;
      bot.push(cadToGltf(x, y, 0));
      top.push(cadToGltf(x, y, height));
    }
    const centerBot = cadToGltf(cx, cy, 0);
    const centerTop = cadToGltf(cx, cy, height);
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      this.addTri(centerBot, bot[j]!, bot[i]!);
      this.addTri(centerTop, top[i]!, top[j]!);
      this.addQuad(bot[i]!, bot[j]!, top[j]!, top[i]!);
    }
  }
}

function materialIndexForLayer(layer: string): number {
  const key = layer.replace(/-GHOST$/i, "").toUpperCase();
  switch (key) {
    case "STRUCTURES":
      return 0;
    case "PLANTING":
    case "TRP":
      return 1;
    case "HARDSCAPE":
      return 2;
    case "WATER":
    case "IRRIGATION":
      return 3;
    case "SERVICES":
      return 4;
    default:
      return 5;
  }
}

/**
 * Build a single-scene glTF 2.0 document (JSON string) from CAD metres.
 */
export function cadDocumentToGltf(doc: CadDocument): string {
  const buckets: MeshAccum[] = Array.from({ length: 6 }, () => new MeshAccum());

  for (const e of doc.entities) {
    if (e.ghost) continue;
    const mat = materialIndexForLayer(e.layer);
    const mesh = buckets[mat]!;

    switch (e.kind) {
      case "polyline": {
        if (e.points.length < 2) break;
        if (e.closed && e.points.length >= 3) {
          mesh.extrudePolyline(
            e.points,
            heightForClosedPolyline(e, doc),
            true,
          );
        } else {
          mesh.extrudePolyline(e.points, 0.12, false);
        }
        break;
      }
      case "line":
        mesh.extrudePolyline([e.start, e.end], 0.12, false);
        break;
      case "circle":
        mesh.addCylinder(e.center.x, e.center.y, e.radius, 0.4);
        break;
      case "insert": {
        const r = Math.max(0.25, 0.4 * (e.scale ?? 1));
        const h =
          e.layer.toUpperCase().includes("PLANT") ||
          materialIndexForLayer(e.layer) === 1
            ? 1.8 * (e.scale ?? 1)
            : 0.6;
        mesh.addCylinder(e.position.x, e.position.y, r, h);
        break;
      }
      default:
        break;
    }
  }

  // Ground plane so empty docs still open in viewers.
  const ground = buckets[5]!;
  ground.addQuad(
    cadToGltf(0, 0, 0),
    cadToGltf(doc.width_m, 0, 0),
    cadToGltf(doc.width_m, doc.height_m, 0),
    cadToGltf(0, doc.height_m, 0),
  );

  const materials = [
    {
      name: "structures",
      pbrMetallicRoughness: {
        baseColorFactor: [0.55, 0.52, 0.48, 1],
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    },
    {
      name: "planting",
      pbrMetallicRoughness: {
        baseColorFactor: [0.28, 0.48, 0.32, 1],
        metallicFactor: 0,
        roughnessFactor: 0.95,
      },
    },
    {
      name: "hardscape",
      pbrMetallicRoughness: {
        baseColorFactor: [0.62, 0.6, 0.58, 1],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    },
    {
      name: "water",
      pbrMetallicRoughness: {
        baseColorFactor: [0.35, 0.5, 0.62, 0.85],
        metallicFactor: 0.1,
        roughnessFactor: 0.35,
      },
      alphaMode: "BLEND",
    },
    {
      name: "services",
      pbrMetallicRoughness: {
        baseColorFactor: [0.75, 0.55, 0.2, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    },
    {
      name: "ground",
      pbrMetallicRoughness: {
        baseColorFactor: [0.82, 0.78, 0.7, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ];

  const binParts: Uint8Array[] = [];
  const bufferViews: Array<{
    buffer: number;
    byteOffset: number;
    byteLength: number;
    target?: number;
  }> = [];
  const accessors: Array<{
    bufferView: number;
    componentType: number;
    count: number;
    type: string;
    max?: number[];
    min?: number[];
  }> = [];
  const meshes: Array<{
    name: string;
    primitives: Array<{ attributes: { POSITION: number }; indices: number; material: number }>;
  }> = [];
  const nodes: Array<{ mesh: number; name: string }> = [];

  let byteOffset = 0;

  const align4 = (n: number) => (n + 3) & ~3;

  for (let mi = 0; mi < buckets.length; mi++) {
    const bucket = buckets[mi]!;
    if (bucket.indices.length === 0) continue;

    const pos = new Float32Array(bucket.positions);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      minX = Math.min(minX, pos[i]!);
      minY = Math.min(minY, pos[i + 1]!);
      minZ = Math.min(minZ, pos[i + 2]!);
      maxX = Math.max(maxX, pos[i]!);
      maxY = Math.max(maxY, pos[i + 1]!);
      maxZ = Math.max(maxZ, pos[i + 2]!);
    }

    const posBytes = new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength);
    const posPad = align4(posBytes.byteLength) - posBytes.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: posBytes.byteLength,
      target: 34962,
    });
    const posAccessor = accessors.length;
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: 5126,
      count: pos.length / 3,
      type: "VEC3",
      max: [maxX, maxY, maxZ],
      min: [minX, minY, minZ],
    });
    binParts.push(posBytes);
    if (posPad) binParts.push(new Uint8Array(posPad));
    byteOffset += posBytes.byteLength + posPad;

    const use32 = bucket.indices.some((i) => i > 65535);
    const idx = use32
      ? new Uint32Array(bucket.indices)
      : new Uint16Array(bucket.indices);
    const idxBytes = new Uint8Array(idx.buffer, idx.byteOffset, idx.byteLength);
    const idxPad = align4(idxBytes.byteLength) - idxBytes.byteLength;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: idxBytes.byteLength,
      target: 34963,
    });
    const idxAccessor = accessors.length;
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: use32 ? 5125 : 5123,
      count: bucket.indices.length,
      type: "SCALAR",
    });
    binParts.push(idxBytes);
    if (idxPad) binParts.push(new Uint8Array(idxPad));
    byteOffset += idxBytes.byteLength + idxPad;

    const meshIndex = meshes.length;
    meshes.push({
      name: materials[mi]!.name,
      primitives: [
        {
          attributes: { POSITION: posAccessor },
          indices: idxAccessor,
          material: mi,
        },
      ],
    });
    nodes.push({ mesh: meshIndex, name: materials[mi]!.name });
  }

  const totalLen = byteOffset;
  const bin = new Uint8Array(totalLen);
  let o = 0;
  for (const part of binParts) {
    bin.set(part, o);
    o += part.length;
  }

  // Node Buffer → base64 without depending on browser btoa.
  const b64 = Buffer.from(bin).toString("base64");

  const gltf = {
    asset: {
      version: "2.0",
      generator: "workstream-cad",
      copyright: HONESTY,
      extras: {
        honesty: "working_plan",
        note: HONESTY,
        width_m: doc.width_m,
        height_m: doc.height_m,
        project_id: doc.project_id,
      },
    },
    scene: 0,
    scenes: [{ name: "plan", nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [
      {
        byteLength: totalLen,
        uri: `data:application/octet-stream;base64,${b64}`,
      },
    ],
    materials,
  };

  return `${JSON.stringify(gltf, null, 2)}\n`;
}
