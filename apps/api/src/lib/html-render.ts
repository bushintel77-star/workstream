import { marked } from "marked";
import type { OutputKind, Project } from "@workstream/contracts";

/**
 * Wrap markdown output in a Curtis & Co–branded HTML document.
 * Self-contained: all CSS inline, no external assets, no JS. Renders nicely
 * in any modern browser and prints to a clean PDF via the browser's
 * built-in Save-as-PDF.
 */

type Args = {
  kind: OutputKind;
  project: Project;
  markdown: string;
};

const KIND_TITLE: Record<OutputKind, string> = {
  task_list: "Task List",
  schedule: "Schedule",
  quote: "Quote",
  scope: "Scope of Works",
  daily_site_report: "Daily Site Report",
  permit_stonnington_stormwater: "Stonnington Stormwater Permit",
  permit_yarra_heritage: "Yarra Heritage Application",
  brochure: "Brochure",
};

const KIND_CLASS: Record<OutputKind, string> = {
  task_list: "tone-tradeops",
  schedule: "tone-tradeops",
  quote: "tone-client",
  scope: "tone-internal",
  daily_site_report: "tone-tradeops",
  permit_stonnington_stormwater: "tone-permit",
  permit_yarra_heritage: "tone-permit",
  brochure: "tone-client",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHtml(args: Args): string {
  marked.setOptions({ gfm: true, breaks: false });
  const body = marked.parse(args.markdown, { async: false }) as string;

  const docTitle = `${KIND_TITLE[args.kind]} — ${args.project.address}`;
  const generated = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(docTitle)}</title>
<style>
  :root {
    --surface-base: #FAFAF7;
    --surface-elevated: #FFFFFF;
    --surface-sunken: #F4F4F1;
    --ink-primary: #18181B;
    --ink-secondary: #52525B;
    --ink-tertiary: #A1A1AA;
    --line-hairline: #E4E4E7;
    --line-strong: #D4D4D8;
    --accent: #C2410C;
    --accent-soft: #FED7AA;
    --accent-ink: #7C2D12;
    --semantic-ok: #15803D;
    --semantic-warn: #B45309;
    --semantic-block: #B91C1C;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--surface-base);
    color: var(--ink-primary);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 48px 96px;
    background: var(--surface-elevated);
    min-height: 100vh;
    border-left: 1px solid var(--line-hairline);
    border-right: 1px solid var(--line-hairline);
  }
  header.masthead {
    border-bottom: 2px solid var(--ink-primary);
    padding-bottom: 16px;
    margin-bottom: 32px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 32px;
  }
  .brand {
    font-family: "Inter Display", "Inter", serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink-primary);
  }
  .brand-sub {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-tertiary);
    margin-top: 2px;
  }
  .doc-meta {
    text-align: right;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-tertiary);
  }
  .doc-meta strong { color: var(--accent); display: block; }
  h1, h2, h3, h4 {
    font-family: "Inter Display", "Inter", sans-serif;
    color: var(--ink-primary);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  h1 { font-size: 32px; margin: 0 0 8px; letter-spacing: -0.02em; }
  h2 { font-size: 20px; margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--line-hairline); }
  h3 { font-size: 16px; margin: 24px 0 8px; color: var(--ink-secondary); }
  p { margin: 0 0 12px; color: var(--ink-primary); }
  ul, ol { margin: 0 0 16px; padding-left: 22px; }
  li { margin: 4px 0; }
  strong { color: var(--ink-primary); font-weight: 600; }
  blockquote {
    margin: 16px 0;
    padding: 12px 20px;
    border-left: 3px solid var(--accent);
    background: var(--surface-sunken);
    font-style: italic;
    color: var(--ink-secondary);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px;
    font-variant-numeric: tabular-nums;
  }
  th, td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line-hairline);
  }
  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-tertiary);
    border-bottom: 1px solid var(--ink-primary);
  }
  code {
    font-family: "JetBrains Mono", "SF Mono", monospace;
    font-size: 13px;
    background: var(--surface-sunken);
    padding: 1px 5px;
    border-radius: 3px;
    color: var(--ink-primary);
  }
  hr { border: 0; border-top: 1px solid var(--line-hairline); margin: 32px 0; }
  footer.colophon {
    margin-top: 64px;
    padding-top: 16px;
    border-top: 1px solid var(--line-hairline);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-tertiary);
    display: flex;
    justify-content: space-between;
  }
  .tone-client h1 { color: var(--accent-ink); }
  .tone-permit { background: var(--surface-sunken); }
  .tone-permit .page { background: #FFFEFA; }
  @media print {
    body { background: white; }
    .page { box-shadow: none; border: none; padding: 32px 0; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
</style>
</head>
<body class="${KIND_CLASS[args.kind]}">
<div class="page">
  <header class="masthead">
    <div>
      <div class="brand">Curtis &amp; Co</div>
      <div class="brand-sub">Boutique Landscape Design · Melbourne</div>
    </div>
    <div class="doc-meta">
      <strong>${escapeHtml(KIND_TITLE[args.kind])}</strong>
      ${escapeHtml(generated)}
    </div>
  </header>
  ${body}
  <footer class="colophon">
    <div>Curtis &amp; Co · ${escapeHtml(args.project.address)}</div>
    <div>Prepared with Workstream</div>
  </footer>
</div>
</body>
</html>`;
}
