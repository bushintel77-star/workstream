"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryItem, SiteContext, Survey } from "../lib/api";
import { ProjectTitleHero } from "./ProjectTitleSiteMap";
import g from "./swipe-gallery.module.css";

/** Slide 0 is always a branded title card; `items` are uploads and site photos only. */
export function SwipeGallery({
  items,
  address,
  survey,
  siteContext,
  titleKicker = "Project filing",
}: {
  items: GalleryItem[];
  address: string;
  survey: Survey | null;
  siteContext?: SiteContext | null;
  titleKicker?: string;
}) {
  const slideCount = 1 + items.length;
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (delta: number) => {
      if (slideCount === 0) return;
      setIndex((i) => (i + delta + slideCount) % slideCount);
    },
    [slideCount],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const isTitleSlide = index === 0;
  const item = !isTitleSlide ? items[index - 1] : null;
  const isPdf = item?.mime_type.includes("pdf") ?? false;

  let touchStartX = 0;

  return (
    <div className={g.wrap}>
      <div
        className={g.stage}
        onTouchStart={(e) => {
          touchStartX = e.touches[0]?.clientX ?? 0;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? 0;
          const dx = endX - touchStartX;
          if (dx > 48) go(-1);
          if (dx < -48) go(1);
        }}
      >
        {isTitleSlide ? (
          <div className={g.titleSlot}>
            <ProjectTitleHero
              survey={survey}
              address={address}
              siteContext={siteContext}
              kicker={titleKicker}
            />
          </div>
        ) : isPdf ? (
          <iframe
            className={g.pdfFrame}
            src={item!.uri}
            title={item!.title}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={g.media} src={item!.uri} alt={item!.title} />
        )}
      </div>

      <div className={g.meta}>
        <div>
          <div className={g.title}>
            {isTitleSlide ? address : item!.title}
          </div>
          <span className={g.pill}>
            {isTitleSlide ? "Title" : `${item!.source} · ${item!.kind}`}
          </span>
        </div>
        <div className={g.nav}>
          <button
            type="button"
            className={g.navBtn}
            aria-label="Previous"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={g.navBtn}
            aria-label="Next"
            onClick={() => go(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className={g.dots} role="tablist" aria-label="Gallery slides">
        {Array.from({ length: slideCount }, (_, i) => (
          <button
            key={i === 0 ? "title" : items[i - 1]!.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={
              i === 0 ? "Title" : `Slide ${i + 1}: ${items[i - 1]!.title}`
            }
            className={`${g.dot} ${i === index ? g.dotActive : ""}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
