"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listProjects, type Project } from "../../lib/api";
import css from "./siteSwitcherPopover.module.css";

type Props = {
  currentProjectId: string;
  buttonClassName?: string;
};

export function SiteSwitcherPopover({
  currentProjectId,
  buttonClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Project[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void listProjects()
      .then(setSites)
      .catch(() => setSites([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={css.wrap} ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        data-testid="canvas-sites-top"
        onClick={() => setOpen((v) => !v)}
      >
        Sites ▾
      </button>
      {open ? (
        <div className={css.popover} role="dialog" aria-label="Sites">
          {sites.length === 0 ? (
            <p className={css.empty}>Loading sites…</p>
          ) : (
            sites.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}?mode=survey`}
                className={`${css.row}${p.id === currentProjectId ? ` ${css.rowActive}` : ""}`}
                onClick={() => setOpen(false)}
              >
                {p.address ?? p.id}
                <span className={css.mute}>{p.id.slice(0, 8)}…</span>
              </Link>
            ))
          )}
          <Link href="/" className={css.row} onClick={() => setOpen(false)}>
            All sites
          </Link>
        </div>
      ) : null}
    </div>
  );
}
