import s from "../styles/app.module.css";
import p from "../app/projects/[id]/project.module.css";

const ITEMS = [
  "Measure paving area exactly (biggest cost driver)",
  "Mark steel edge linear metres front + rear",
  "Confirm gravel m² and depth at bin + decorative areas",
  "Photograph decking — cut-back line and repair allowance",
  "Locate water feature — protection plan during works",
  "Retained vegetation root zones — no excavation inside dripline",
  "Rear lane access for skip/excavator (Prahran ROW often <2.5 m)",
  "Locate water mains for new taps (front + rear)",
  "Locate electrical mains / sub-board for LV lighting",
  "Photograph all pots — retained, relocated, or removed",
  "Trees marked for removal — council permit required?",
  "Discuss Lean scenario substitutions — client yes/no",
  "Client-supplied items: furniture, BBQ, clothesline, tank, firepit",
  "Timeline: start, completion, milestones",
  "Soil exposure in open beds — assess condition",
  "Step detail with designer — mitre vs bullnose (variation V1)",
  "Lilydale toppings acceptable as Dromana sub?",
] as const;

export function SiteWalkChecklist() {
  return (
    <section className={p.siteWalk}>
      <h2 className={s.sectionHeading}>Site walk checklist</h2>
      <p className={s.lede}>
        Verify on site before going firm. Print or tick on mobile at the property.
      </p>
      <ul className={p.checklist}>
        {ITEMS.map((item) => (
          <li key={item}>
            <span className={p.checkBox} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
