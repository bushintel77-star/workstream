import type { CadDocument, CadEntity } from "@workstream/contracts";

/** Minimal ASCII DXF (R12-ish) for LibreCAD / AutoCAD interchange. */
export function cadDocumentToDxf(doc: CadDocument): string {
  const lines: string[] = [];
  const w = (code: number | string, value: string | number) => {
    lines.push(String(code), String(value));
  };

  w(0, "SECTION");
  w(2, "HEADER");
  w(9, "$INSUNITS");
  w(70, 6); // metres
  w(9, "$EXTMIN");
  w(10, 0);
  w(20, 0);
  w(30, 0);
  w(9, "$EXTMAX");
  w(10, doc.width_m);
  w(20, doc.height_m);
  w(30, 0);
  w(0, "ENDSEC");

  w(0, "SECTION");
  w(2, "TABLES");
  w(0, "TABLE");
  w(2, "LAYER");
  w(70, doc.layers.length);
  for (const layer of doc.layers) {
    w(0, "LAYER");
    w(2, layer.name);
    w(70, layer.frozen ? 1 : 0);
    w(62, layer.color ?? 7);
    w(6, "CONTINUOUS");
  }
  w(0, "ENDTAB");
  w(0, "ENDSEC");

  w(0, "SECTION");
  w(2, "ENTITIES");
  for (const e of doc.entities) {
    // Ghosts export too so LibreCAD can review AI proposals; layer name prefix
    writeEntity(w, e, e.ghost ? `${e.layer}-GHOST` : e.layer);
  }
  w(0, "ENDSEC");
  w(0, "EOF");
  return lines.join("\n");
}

function writeEntity(
  w: (code: number | string, value: string | number) => void,
  e: CadEntity,
  layer: string,
): void {
  switch (e.kind) {
    case "line":
      w(0, "LINE");
      w(8, layer);
      w(10, e.start.x);
      w(20, e.start.y);
      w(30, 0);
      w(11, e.end.x);
      w(21, e.end.y);
      w(31, 0);
      break;
    case "polyline": {
      w(0, "LWPOLYLINE");
      w(8, layer);
      w(90, e.points.length);
      w(70, e.closed ? 1 : 0);
      for (const p of e.points) {
        w(10, p.x);
        w(20, p.y);
      }
      break;
    }
    case "circle":
      w(0, "CIRCLE");
      w(8, layer);
      w(10, e.center.x);
      w(20, e.center.y);
      w(30, 0);
      w(40, e.radius);
      break;
    case "arc":
      w(0, "ARC");
      w(8, layer);
      w(10, e.center.x);
      w(20, e.center.y);
      w(30, 0);
      w(40, e.radius);
      w(50, e.start_angle_deg);
      w(51, e.end_angle_deg);
      break;
    case "text":
      w(0, "TEXT");
      w(8, layer);
      w(10, e.position.x);
      w(20, e.position.y);
      w(30, 0);
      w(40, e.height);
      w(1, e.value.replace(/\n/g, " "));
      w(50, e.rotation_deg);
      break;
    case "insert":
      // Point marker + block name as text (blocks not fully exploded in V1)
      w(0, "POINT");
      w(8, layer);
      w(10, e.position.x);
      w(20, e.position.y);
      w(30, 0);
      w(0, "TEXT");
      w(8, layer);
      w(10, e.position.x + 0.15);
      w(20, e.position.y + 0.15);
      w(30, 0);
      w(40, 0.25 * e.scale);
      w(1, e.block_name);
      w(50, e.rotation_deg);
      break;
    case "dimension": {
      const midX = (e.p1.x + e.p2.x) / 2;
      const midY = (e.p1.y + e.p2.y) / 2;
      const len = Math.hypot(e.p2.x - e.p1.x, e.p2.y - e.p1.y);
      w(0, "LINE");
      w(8, layer);
      w(10, e.p1.x);
      w(20, e.p1.y);
      w(30, 0);
      w(11, e.p2.x);
      w(21, e.p2.y);
      w(31, 0);
      w(0, "TEXT");
      w(8, layer);
      w(10, midX);
      w(20, midY + e.offset);
      w(30, 0);
      w(40, 0.3);
      w(1, `${len.toFixed(2)} m`);
      break;
    }
  }
}
