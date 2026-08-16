"use client";

import dynamic from "next/dynamic";

const DemoGarden = dynamic(
  () =>
    import("@/components/canvas/webgl/demo/DemoGarden").then(
      (m) => m.DemoGarden,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "var(--gs-canvas)",
          color: "var(--gs-ink)",
          fontFamily: "var(--font-tech, monospace)",
          fontSize: 12,
          letterSpacing: "0.06em",
        }}
      >
        LOADING DEMO GARDEN…
      </div>
    ),
  },
);

export function DemoGardenMount() {
  return <DemoGarden />;
}
