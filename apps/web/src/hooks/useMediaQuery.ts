"use client";

import { useEffect, useState } from "react";

/** Match a CSS media query in the browser. */
export function useMediaQuery(query: string): boolean {
  /* Always start false so SSR HTML matches the first client paint. */
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
