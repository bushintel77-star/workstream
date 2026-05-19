import { getProject, listPhotoMeasurements } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";

export const dynamic = "force-dynamic";

const UNIT_LABEL: Record<string, string> = {
  meters: "m",
  centimeters: "cm",
  millimeters: "mm",
  square_meters: "m²",
  cubic_meters: "m³",
  unknown: "?",
};

export default async function MeasurementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const measurements = await listPhotoMeasurements(id).catch(() => []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="measurements" />

      <h1 className={s.headline}>Photo measurements</h1>
      <p className={s.lede}>
        Snap a photo of a wall, fence, garden bed — Claude Vision measures it
        against a known reference object. Used for awkward dimensions the
        Vicmap polygon misses.
      </p>

      <div className={s.banner}>
        Captures land here from the operator mobile app via{" "}
        <span className={s.mono}>POST /projects/{id}/measurements/photo</span>.
        Direct web upload is coming once CORS is set on the API.
      </div>

      {measurements.length === 0 ? (
        <div className={s.empty}>
          No photo measurements yet. Use the mobile app on site to capture one.
        </div>
      ) : (
        <ul className={s.list}>
          {measurements.map((m) => (
            <li key={m.id} className={p.measurementCard}>
              <div className={p.measurementHead}>
                <span className={s.dim}>{fmt(m.created_at)}</span>
              </div>
              <img
                src={m.image_uri}
                alt="Site measurement reference"
                className={p.measurementImage}
                loading="lazy"
              />
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>What</th>
                    <th className={s.alignRight}>Value</th>
                    <th>Reference</th>
                    <th className={s.alignRight}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {m.items.map((it, i) => (
                    <tr key={i}>
                      <td>{it.description}</td>
                      <td className={`${s.alignRight} ${s.mono}`}>
                        {it.value.toFixed(2)} {UNIT_LABEL[it.unit] ?? it.unit}
                      </td>
                      <td className={s.dim}>{it.reference_used ?? "—"}</td>
                      <td className={`${s.alignRight} ${s.mono}`}>
                        {Math.round(it.confidence * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {m.notes && <p className={p.transcript}>{m.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
