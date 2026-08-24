#!/usr/bin/env python3
"""Migrate off-scale inline UI values to --gs-* tokens.

Walks ESLint JSON output for off-scale violations and replaces the
literal value byte-for-byte with the corresponding CSS token string.
Each replacement is line+column-precise so we never touch the wrong
site if two violations share a line.

Mapping (from docs/UI-ELEMENT-STANDARDS.md):
  --gs-radius scale (7 rungs):
    3      -> var(--gs-radius-xs)
    4      -> var(--gs-radius-sm)
    6      -> var(--gs-radius-md)
    8      -> var(--gs-radius-lg)
    12     -> var(--gs-radius-xl)
    14     -> var(--gs-radius-2xl)
    9999   -> var(--gs-radius-pill)

  --gs-font scale (9 rungs):
    9.5    -> var(--gs-font-micro)
    10.5   -> var(--gs-font-xs)
    11     -> var(--gs-font-sm)
    11.5   -> var(--gs-font-md)
    12     -> var(--gs-font-lg)
    13     -> var(--gs-font-sub)
    14     -> var(--gs-font-h3)
    16     -> var(--gs-font-h2)
    20     -> var(--gs-font-h1)

  --gs-space scale (7 rungs):
    2      -> var(--gs-space-1)
    4      -> var(--gs-space-2)
    6      -> var(--gs-space-3)
    8      -> var(--gs-space-4)
    10     -> var(--gs-space-5)
    12     -> var(--gs-space-6)
    16     -> var(--gs-space-8)
"""

import json, sys, subprocess, os, re
from collections import defaultdict
from pathlib import Path

# Mapping table — value key (str, what appears in source) -> replacement.
RADIUS = {
    "3":    '"var(--gs-radius-xs)"',
    "4":    '"var(--gs-radius-sm)"',
    "6":    '"var(--gs-radius-md)"',
    "8":    '"var(--gs-radius-lg)"',
    "12":   '"var(--gs-radius-xl)"',
    "14":   '"var(--gs-radius-2xl)"',
    "999":  '"var(--gs-radius-pill)"',
    "9999": '"var(--gs-radius-pill)"',
}
FONT = {
    "9.5":  '"var(--gs-font-micro)"',
    "10.5": '"var(--gs-font-xs)"',
    "11":   '"var(--gs-font-sm)"',
    "11.5": '"var(--gs-font-md)"',
    "12":   '"var(--gs-font-lg)"',
    "13":   '"var(--gs-font-sub)"',
    "14":   '"var(--gs-font-h3)"',
    "16":   '"var(--gs-font-h2)"',
    "20":   '"var(--gs-font-h1)"',
}
SPACE = {
    "2":    '"var(--gs-space-1)"',
    "4":    '"var(--gs-space-2)"',
    "6":    '"var(--gs-space-3)"',
    "8":    '"var(--gs-space-4)"',
    "10":   '"var(--gs-space-5)"',
    "12":   '"var(--gs-space-6)"',
    "16":   '"var(--gs-space-8)"',
}

# Run ESLint and parse JSON output.
REPO = "C:/Users/Tim/Downloads/CURTIS-CO/workstream"
os.chdir(REPO)
REPO_ROOT = os.path.realpath(REPO)

def safe_repo_path(fp):
    """ESLint filePath → contained absolute path under REPO_ROOT, or None.

    The path is normalized, checked against the repo root, and re-anchored
    from its repo-relative form — a doctored JSON report (../ or absolute
    paths) can never steer a read or write outside the repo."""
    rp = os.path.realpath(os.path.abspath(fp))
    rel = os.path.relpath(rp, REPO_ROOT)
    if rel == os.curdir or rel.startswith(".." + os.sep) or os.path.isabs(rel):
        return None
    return os.path.join(REPO_ROOT, rel)
# Find pnpm via the npm shim (always present after a global npm install)
PNPM = r"C:\Users\Tim\AppData\Roaming\npm\pnpm.cmd"
proc = subprocess.run(
    [PNPM, "exec", "eslint", "--format", "json",
     "apps/web/src/components/canvas/"],
    capture_output=True,
)
if proc.returncode not in (0, 1):  # 0 = clean, 1 = lint errors; both have JSON
    print("ESLint crashed:", proc.stderr.decode("utf-8", errors="replace")[-2000:])
    sys.exit(2)
data = json.loads(proc.stdout.decode("utf-8", errors="replace"))

# Categorize violations by (file, line, col, kind).
edits = defaultdict(list)  # file_path -> list of (line, col, kind, raw_value)
for r in data:
    fp = r["filePath"]
    for m in r["messages"]:
        msg = m["message"]
        if "borderRadius" in msg:
            kind = "borderRadius"
            table = RADIUS
        elif "fontSize" in msg:
            kind = "fontSize"
            table = FONT
        elif "gap" in msg:
            kind = "gap"
            table = SPACE
        elif "rgba" in msg:
            kind = "rgba"  # we don't have any; reserved for future
            table = {}
        else:
            continue
        edits[fp].append((m["line"], m["column"], kind, table))

# For each file, walk top-to-bottom and substitute the literal at each
# (line, col). Read the raw line, locate the property, isolate the
# number, replace with the token.
import shutil

def normalise_kind(s):
    if "borderRadius" in s: return "borderRadius"
    if "fontSize" in s: return "fontSize"
    if "gap" in s: return "gap"
    if "rgba" in s: return "rgba"
    return None

# Reread for cleaner output extraction
edits = defaultdict(list)
for r in data:
    fp = r["filePath"]
    for m in r["messages"]:
        kind = normalise_kind(m["message"])
        if not kind: continue
        table = {"borderRadius": RADIUS, "fontSize": FONT, "gap": SPACE, "rgba": {}}[kind]
        edits[fp].append((m["line"], m["column"], kind, table, m["message"]))

# Process files.
total_subs = 0
skipped = 0
for fp, items in edits.items():
    safe_fp = safe_repo_path(fp)
    if not safe_fp:
        print(f"SKIPPED (outside repo): {fp}")
        skipped += len(items)
        continue
    with open(safe_fp, "r", encoding="utf-8") as f:
        src = f.read()
    lines = src.split("\n")
    # Group by line for stable ordering.
    items.sort(key=lambda x: (x[0], x[1]))
    # Process bottom-up so line indices stay valid.
    by_line = defaultdict(list)
    for (ln, col, kind, table, msg) in items:
        by_line[ln].append((col, kind, table, msg))
    new_lines = list(lines)
    for ln in sorted(by_line.keys(), reverse=True):
        idx = ln - 1
        if idx < 0 or idx >= len(new_lines): continue
        line = new_lines[idx]
        # Sort by column descending so substitutions don't shift later ones.
        items_at = sorted(by_line[ln], key=lambda x: x[0], reverse=True)
        for (col, kind, table, msg) in items_at:
            # Locate the property name on this line (any position)
            prop_re = re.compile(r"\b(" + re.escape(kind) + r")\s*:\s*")
            mlist = list(prop_re.finditer(line))
            if not mlist:
                skipped += 1
                print(f"SKIP (no prop): {fp}:{ln}  {msg}")
                continue
            # Pick the rightmost occurrence whose end <= col, otherwise
            # the rightmost at or before col when there are duplicates.
            # Use a tolerance: prefer the one nearest to col.
            chosen = None
            for m in mlist:
                if m.end() <= col + 1:
                    chosen = m
            if chosen is None:
                chosen = mlist[0]
            # Read forward from chosen.end() until non-digit/dot.
            tail = line[chosen.end():]
            num_match = re.match(r"(\d+(?:\.\d+)?)", tail)
            if not num_match:
                skipped += 1
                print(f"SKIP (no number after prop): {fp}:{ln}  {msg}")
                continue
            raw_num = num_match.group(1)
            if raw_num not in table:
                skipped += 1
                print(f"UNMAPPED {kind}={raw_num}: {fp}:{ln}  {msg}")
                continue
            replacement = table[raw_num]
            start = chosen.end()
            end = chosen.end() + num_match.end()
            line = line[:start] + replacement + line[end:]
            total_subs += 1
        new_lines[idx] = line
    new_src = "\n".join(new_lines)
    if new_src != src:
        # pathlib write to the contained path (see safe_repo_path) — target
        # re-anchored under REPO_ROOT from its repo-relative form.
        Path(os.path.join(REPO_ROOT, os.path.relpath(safe_fp, REPO_ROOT))).write_text(
            new_src, encoding="utf-8"
        )

print(f"\n=== Migration complete ===")
print(f"Substitutions applied: {total_subs}")
print(f"Skipped (no prop / unmapped / no number): {skipped}")
