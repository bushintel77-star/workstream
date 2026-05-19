import p from "../app/projects/[id]/project.module.css";

const ITEMS = [
  "Measure paving area exactly (biggest cost driver)",
  "Mark steel edge linear metres front + rear",
  "Confirm gravel mù and depth at bin + decorative areas",
  "Photograph decking ù cut-back line and repair allowance",
  "Locate water feature ù protection plan during works",
  "Retained vegetation root zones ù no excavation inside dripline",
  "Rear lane access for skip/excavator (Prahran ROW often <2.5 m)",
  "Locate water mains for new taps (front + rear)",
  "Locate electrical mains / sub-board for LV lighting",
  "Photograph all pots ù retained, relocated, or removed",
  "Trees marked for removal ù council permit required?",
  "Discuss Lean scenario substitutions ù client yes/no",
  "Client-supplied items: furniture, BBQ, clothesline, tank, firepit",
  "Timeline: start, completion, milestones",
  "Soil exposure in open beds ù assess condition",
  "Step detail with designer ù mitre vs bullnose (variation V1)",
  "Lilydale toppings acceptable as Dromana sub?",
] as const;

export function SiteWalkChecklist() {
  return (
    <details className={p.siteWalk}>
      <summary className={p.siteWalkSummary}>
        Site walk checklist
        <span className={p.siteWalkHint}>17 items ù expand before going firm</span>
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
