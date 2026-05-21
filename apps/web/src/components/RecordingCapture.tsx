"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import s from "../styles/app.module.css";
import { useToast } from "./ToastHost";

type Props = {
  projectId: string;
  uploadUrl: string;
};

type Phase = "idle" | "recording" | "uploading" | "error";

export function RecordingCapture({ projectId, uploadUrl }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [supported, setSupported] = useState<boolean | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    if (phase === "recording") return;
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const duration = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        await upload(blob, duration);
      };
      recorderRef.current = rec;
      rec.start(250);
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec(
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        );
      }, 250);
      setPhase("recording");
    } catch (err) {
      setPhase("error");
      const msg =
        err instanceof Error ? err.message : "Microphone permission denied";
      toast.show(msg, "error", 5000);
    }
  };

  const stop = () => {
    if (phase !== "recording") return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase("uploading");
    recorderRef.current?.stop();
  };

  const upload = async (blob: Blob, durationSec: number) => {
    const form = new FormData();
    const ext = blob.type.includes("webm") ? "webm" : "m4a";
    form.append("file", blob, `walk-${Date.now()}.${ext}`);
    form.append("duration_s", String(durationSec));
    try {
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
      }
      toast.show("Recording uploaded — pipeline started", "success", 2500);
      setPhase("idle");
      setElapsedSec(0);
      router.push(`/projects/${projectId}/processing`);
    } catch (err) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.show(msg, "error", 6000);
    }
  };

  if (supported === false) {
    return (
      <div className={s.banner}>
        Your browser doesn&apos;t support audio capture. Use the mobile app, or
        Chrome / Safari / Firefox on a recent device.
      </div>
    );
  }

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={s.actionBar}>
      {phase === "recording" ? (
        <>
          <button type="button" onClick={stop} className={`${s.btn} ${s.btnAccent}`}>
            ■ Stop · {fmtTime(elapsedSec)}
          </button>
          <span className={`${s.pill} ${s.pillAccent}`}>Recording</span>
        </>
      ) : phase === "uploading" ? (
        <button type="button" disabled className={s.btn}>
          Uploading…
        </button>
      ) : (
        <button type="button" onClick={start} className={s.btn}>
          ● Start recording
        </button>
      )}
    </div>
  );
}
