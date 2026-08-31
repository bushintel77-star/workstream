import { PipelineShellLoading } from "../components/PipelineShellLoading";

/**
 * Root loading boundary.
 *
 * `/` and `/home` both resolve the most recent project and `redirect()` onto
 * its canvas, so this boundary is what the operator stares at for the whole
 * server round-trip. It used to render the operator ledger — masthead,
 * "Projects — entries", and seven "Loading project" rows — which is the
 * retired dashboard register: a surface neither route can now reach. On a cold
 * start that meant ~18s of legacy dashboard before the canvas appeared, and it
 * read as the old front end loading, because it was.
 *
 * The canvas skeleton is the honest signal: it is the same shell
 * `/projects/[id]/loading.tsx` uses, so the redirect is now visually
 * continuous instead of a dashboard flash followed by a hard swap.
 */
export default function RootLoading() {
  return <PipelineShellLoading label="Opening canvas" />;
}
