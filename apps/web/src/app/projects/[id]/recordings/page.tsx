import { getProject, listRecordings } from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { RecordingCapture } from "../../../../components/RecordingCapture";

export const dynamic = "force-dynamic";

const fmtDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const sFrac = Math.round(sec % 60);
  return m > 0 ? `${m}m ${sFrac}s` : `${sFrac}s`;
};

export default async function RecordingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const recordings = await listRecordings(id);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="recordings" />

      <h1 className={s.headline}>Recordings</h1>
      <p className={s.lede}>
        Capture a site-walk dictation. Whisper transcribes on upload — the
        dictation pipeline reads the transcript to pull tasks, materials and
        observations.
      </p>

      <RecordingCapture
        projectId={id}
        uploadUrl={`/api/projects/${id}/recordings`}
      />

      {recordings.length === 0 ? (
        <div className={s.empty}>
          No recordings yet. Tap <strong>Start recording</strong> above (grant
          microphone access when prompted).
        </div>
      ) : (
        <ul className={s.list}>
          {recordings.map((r) => (
            <li key={r.id} className={p.recordingCard}>
              <div className={p.recordingMeta}>
                <span className={s.strong}>{fmtDuration(r.duration_s)}</span>
                <span className={s.mono}>
                  {r.transcription_confidence != null
                    ? `${(r.transcription_confidence * 100).toFixed(0)}% confidence`
                    : "Transcribing…"}
                </span>
              </div>
              <audio controls preload="none" src={r.audio_uri}>
                Your browser does not support audio playback.
              </audio>
              {r.transcript ? (
                <p className={p.transcript}>{r.transcript}</p>
              ) : (
                <p className={`${p.transcript} ${p.transcriptPending}`}>
                  Transcript pending — Whisper is processing this clip.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
