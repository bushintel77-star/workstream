"use client";

import { useLayoutEffect, useState } from "react";

/** Match a CSS media query in the browser. */
export function useMediaQuery(query: string): boolean {
  /* Always start false so SSR HTML matches the first client render.
     Sync in useLayoutEffect (not useEffect) so viewport forks like phone
     chrome apply before paint — useEffect left data-compact stuck at "0"
     until a later resize/change in Playwright and Turbopack loads. */
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
