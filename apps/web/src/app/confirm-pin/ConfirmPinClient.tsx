"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createProjectWithSurveyAction,
  geocodePreviewAction,
} from "../actions";
import s from "../../styles/app.module.css";
import cp from "./confirm-pin.module.css";
import sk from "../../styles/skeleton.module.css";
import { useToast } from "../../components/ToastHost";

type Props = {
  address: string;
  lat: number;
  lng: number;
};

export function ConfirmPinClient({ address, lat, lng }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [aerialUri, setAerialUri] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [loadingPreview, startPreview] = useTransition();
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    startPreview(async () => {
      try {
        const preview = await geocodePreviewAction(lat, lng);
        setAerialUri(preview.aerial_uri);
        setPreviewError(false);
      } catch {
        setAerialUri(null);
        setPreviewError(true);
      }
    });
  }, [lat, lng]);

  function submit(next: "recordings" | "hub") {
    startSubmit(async () => {
      try {
        const fd = new FormData();
        fd.set("address", address);
        fd.set("lat", String(lat));
        fd.set("lng", String(lng));
        const { projectId } = await createProjectWithSurveyAction(fd);
        toast.show("Site plan ready", "success", 3000);
        if (next === "recordings") {
          router.push(`/projects/${projectId}/recordings`);
        } else {
          router.push(`/projects/${projectId}`);
        }
        router.refresh();
      } catch (e) {
        toast.show(
          e instanceof Error ? e.message : "Could not create project",
          "error",
          6000,
        );
      }
    });
  }

  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Curtis &amp; Co
          <span className={s.brandSub}>Confirm site on aerial</span>
        </div>
        <Link href="/" className={s.crumb}>
          ← Projects
        </Link>
      </header>

      <h1 className={s.headline}>Pin the lot</h1>
      <p className={s.lede}>
        Check the satellite view matches the property. We run the survey as soon
        as you confirm so the site plan is ready before you record.
      </p>

      <p className={cp.address}>{address}</p>
      <p className={cp.coords}>
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>

      <div className={cp.aerialFrame}>
        {loadingPreview && (
          <div className={`${sk.skel} ${cp.aerialSkeleton}`} aria-hidden />
        )}
        {!loadingPreview && aerialUri && !previewError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aerialUri} alt="" className={cp.aerial} />
        )}
        {!loadingPreview && (previewError || !aerialUri) && (
          <div className={cp.aerialFallback}>
            Aerial preview unavailable — add Mapbox in Settings, or continue
            anyway.
          </div>
        )}
      </div>

      <div className={cp.actions}>
        <button
          type="button"
          className={s.btn}
          disabled={submitting}
          onClick={() => submit("recordings")}
        >
          {submitting ? "Creating site plan…" : "Looks right → Record"}
        </button>
        <button
          type="button"
          className={s.btnGhost}
          disabled={submitting}
          onClick={() => submit("hub")}
        >
          Create without recording
        </button>
        <Link href="/" className={cp.adjust}>
          Adjust address
        </Link>
      </div>
    </main>
  );
}
