import type { CadDocument, CadEntity } from "@workstream/contracts";

const LAYER_STROKE: Record<string, string> = {
  "SKETCH-REF": "#6b7d72",
  PLANTING: "#1f8a5a",
  HARDSCAPE: "#3a4d42",
  STRUCTURES: "#0c1a14",
  WATER: "#2f7d8c",
  IRRIGATION: "#2f7d8c",
  TRP: "#b42318",
  ANNOTATION: "#3a4d42",
  DIMENSIONS: "#9a7218",
  PERMITS: "#9a7218",
};

function strokeFor(layer: string, ghost: boolean): string {
  const base = LAYER_STROKE[layer] ?? "#0c1a14";
  return ghost ? base : base;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** SVG overlay in document metres; Y flipped for screen (origin top-left). */
export function cadDocumentToSvg(
  doc: CadDocument,
  opts?: { showGhosts?: boolean; committedOnly?: boolean },
): string {
  const showGhosts = opts?.showGhosts !== false;
  const committedOnly = opts?.committedOnly === true;
  const w = doc.width_m;
  const h = doc.height_m;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`,
  );
  parts.push(
    `<g transform="translate(0 ${h}) scale(1 -1)">`,
  );

  for (const e of doc.entities) {
    if (e.ghost && !showGhosts) continue;
    if (committedOnly && e.ghost) continue;
    parts.push(entitySvg(e));
  }

  parts.push("</g>");
  parts.push(
    `<text x="0.4" y="${h - 0.4}" font-size="0.35" fill="#6b7d72" font-family="system-ui,sans-serif">AI CAD · metres · indicative — not a construction drawing</text>`,
  );
  parts.push("</svg>");
  return parts.join("\n");
}

function entitySvg(e: CadEntity): string {
  const opacity = e.ghost ? 0.45 : 0.95;
  const stroke = strokeFor(e.layer, e.ghost);
  const dash = e.ghost ? ' stroke-dasharray="0.25 0.15"' : "";
  const common = `stroke="${stroke}" fill="none" stroke-width="0.08" opacity="${opacity}"${dash} data-id="${e.id}" data-layer="${escapeXml(e.layer)}"`;

  switch (e.kind) {
    case "line":
      return `<line x1="${e.start.x}" y1="${e.start.y}" x2="${e.end.x}" y2="${e.end.y}" ${common} />`;
    case "polyline": {
      const d = e.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");
      const close = e.closed ? " Z" : "";
      return `<path d="${d}${close}" ${common} />`;
    }
    case "circle":
      return `<circle cx="${e.center.x}" cy="${e.center.y}" r="${e.radius}" ${common} />`;
    case "arc": {
      const a0 = (e.start_angle_deg * Math.PI) / 180;
      const a1 = (e.end_angle_deg * Math.PI) / 180;
      const x0 = e.center.x + e.radius * Math.cos(a0);
      const y0 = e.center.y + e.radius * Math.sin(a0);
      const x1 = e.center.x + e.radius * Math.cos(a1);
      const y1 = e.center.y + e.radius * Math.sin(a1);
      const large = Math.abs(e.end_angle_deg - e.start_angle_deg) > 180 ? 1 : 0;
      return `<path d="M ${x0} ${y0} A ${e.radius} ${e.radius} 0 ${large} 1 ${x1} ${y1}" ${common} />`;
    }
    case "text":
      // Text unflipped inside nested inverse group would be mirrored — draw as point + label in outer? Keep simple circle marker.
      return `<g ${common}><circle cx="${e.position.x}" cy="${e.position.y}" r="0.12" fill="${stroke}" stroke="none" opacity="${opacity}" /><!-- ${escapeXml(e.value)} --></g>`;
    case "insert":
      return `<g ${common}><circle cx="${e.position.x}" cy="${e.position.y}" r="${0.2 * e.scale}" fill="${stroke}" fill-opacity="0.35" stroke="${stroke}" stroke-width="0.06"${dash} /><title>${escapeXml(e.block_name)}</title></g>`;
    case "dimension": {
      const midX = (e.p1.x + e.p2.x) / 2;
      const midY = (e.p1.y + e.p2.y) / 2;
      return `<g ${common}><line x1="${e.p1.x}" y1="${e.p1.y}" x2="${e.p2.x}" y2="${e.p2.y}" stroke="${stroke}" stroke-width="0.06" opacity="${opacity}"${dash} /><circle cx="${midX}" cy="${midY}" r="0.08" fill="${stroke}" /></g>`;
    }
  }
}
