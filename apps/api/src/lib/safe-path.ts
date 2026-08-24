import path from "path";

/**
 * Path-containment guards for anything that turns request data (or data
 * derived from it) into a filesystem path. Rule: every user-influenced
 * segment must be a plain filename, and the joined path must resolve inside
 * its declared root. A traversal that slips past one layer is caught by the
 * other.
 */

/** Filenames we will ever accept: no separators, no `..`, no NUL. */
export function safeFileSegment(segment: string): string | null {
  if (!segment || segment.length > 255) return null;
  if (segment.includes("\0")) return null;
  if (/[\\/]$/.test(segment)) return null;
  const base = path.basename(segment);
  if (base !== segment) return null; // separators inside the segment
  if (base === "." || base === "..") return null;
  return base;
}

/**
 * Join `segments` under `root` and resolve. Returns the absolute contained
 * path, or null when the result escapes `root` (absolute segment, `..`,
 * drive-relative tricks). Callers treat null as invalid input — 400/ignore,
 * never a fallback path.
 */
export function containedPath(root: string, ...segments: string[]): string | null {
  const rootResolved = path.resolve(root);
  const target = path.resolve(rootResolved, ...segments);
  const rel = path.relative(rootResolved, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}
