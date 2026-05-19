import p from "../app/projects/[id]/project.module.css";

const ITEMS = [
  "Measure paving area exactly (biggest cost driver)",
  "Mark steel edge linear metres front + rear",
  "Confirm gravel m2 and depth at bin + decorative areas",
  "Photograph decking - cut-back line and repair allowance",
  "Locate water feature - protection plan during works",
  "Retained vegetation root zones - no excavation inside dripline",
  "Rear lane access for skip/excavator (Prahran ROW often <2.5 m)",
  "Locate water mains for new taps (front + rear)",
  "Locate electrical mains / sub-board for LV lighting",
  "Photograph all pots - retained, relocated, or removed",
  "Trees marked for removal - council permit required?",
  "Discuss Lean scenario substitutions - client yes/no",
  "Client-supplied items: furniture, BBQ, clothesline, tank, firepit",
  "Timeline: start, completion, milestones",
  "Soil exposure in open beds - assess condition",
  "Step detail with designer - mitre vs bullnose (variation V1)",
  "Lilydale toppings acceptable as Dromana sub?",
] as const;

export function SiteWalkChecklist() {
  return (
    <details className={p.siteWalk}>
      <summary className={p.siteWalkSummary}>
        Site walk checklist
        <span className={p.siteWalkHint}>
          17 items - expand before going firm
        </span>
      </summary>
      <ul className={p.checklist}>
        {ITEMS.map((item) => (
          <li key={item}>
            <span className={p.checkBox} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
