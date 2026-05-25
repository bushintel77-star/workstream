import wb from "./studioWorkflowBadge.module.css";

/** Workflow 1 — visible in studio so operators know geometry is indicative. */
export function StudioWorkflowBadge() {
  return (
    <p className={wb.badge} role="status" data-testid="studio-workflow-badge">
      <span className={wb.phase}>Workflow 1</span>
      <span className={wb.sep} aria-hidden>
        ·
      </span>
      <span className={wb.label}>Professional sketch</span>
      <span className={wb.hint}>Indicative geometry — not survey CAD</span>
    </p>
  );
}
