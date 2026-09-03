"use client";

import dynamic from "next/dynamic";

// Client wrapper that lazy-loads the WebGL studio with ssr: false.
// This keeps the heavy Three.js/R3F/drei chunks out of the /home route's
// first-load manifest — the studio only loads client-side when the
// zero-projects first-run case actually renders.
const WebGLStudioPreview = dynamic(
  () =>
    import("./WebGLStudioPreview").then((m) => m.WebGLStudioPreview),
  { ssr: false },
);

export function LazyWebGLStudioPreview(
  props: React.ComponentProps<typeof WebGLStudioPreview>,
) {
  return <WebGLStudioPreview {...props} />;
}
