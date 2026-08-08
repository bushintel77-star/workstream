import { STUDIO_SITES } from "../studioCatalog";

/** Minimum shape this rule needs from a site definition. */
type SiteAddr = { addr: string };

/**
 * Resolve the site label shown on the studio canvas.
 *
 * The real project address wins **unless** the operator has explicitly picked a
 * demo site from the switcher.
 *
 * This was previously inline in `useStudioState` as
 * `STUDIO_SITES[siteIdx]?.addr ?? (address || STUDIO_SITES[0]!.addr)`. Because
 * `siteIdx` initialises to `0` and `switchSite` clamps it in range, the left
 * operand was always defined, the `??` never fell through, and `address` was
 * structurally unreachable — every project rendered as the Wrights Terrace demo
 * seed. That also sent `lookupCadastralTitleAction` to the wrong parcel, so the
 * Vicmap building footprint never arrived, `building` stayed empty, and the
 * dwelling envelope plus every sun/shade cast depending on it was suppressed.
 *
 * Extracted to a pure function because `useStudioState` is a hook and `apps/web`
 * has no DOM test environment (no jsdom, no testing-library) — this is the only
 * way the precedence rule gets a regression test.
 *
 * A blank or whitespace-only project address is not a usable site label, so it
 * falls through to the seed rather than rendering an empty title block. A
 * non-blank address is returned **untrimmed**, matching the `projectAddress`
 * value the Quote surface renders, so the two surfaces cannot disagree on
 * spacing.
 */
export function resolveSiteAddress(opts: {
  /** The real project address, as created by the operator. */
  projectAddress: string;
  /** Index into `sites`; only authoritative when `siteExplicit`. */
  siteIdx: number;
  /** True once the operator has used the site switcher. Absent means "not explicit". */
  siteExplicit?: boolean;
  /** Injectable for tests; defaults to the shipped catalog. */
  sites?: readonly SiteAddr[];
}): string {
  const { projectAddress, siteIdx, siteExplicit, sites = STUDIO_SITES } = opts;
  const projectAddr = projectAddress.trim() ? projectAddress : null;
  const picked = sites[siteIdx]?.addr ?? null;
  const seed = sites[0]?.addr ?? null;

  const resolved = siteExplicit
    ? (picked ?? projectAddr ?? seed)
    : (projectAddr ?? picked ?? seed);

  // Every branch above can be null only when `sites` is empty and the project
  // address is blank. Returning "" beats throwing inside a render path.
  return resolved ?? "";
}
