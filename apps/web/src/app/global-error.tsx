"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body
        style={{
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#FAFAF7",
          color: "#18181B",
          margin: 0,
          padding: "48px 24px",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 12px",
            }}
          >
            Workstream hit a hard error
          </h1>
          <p style={{ color: "#52525B", lineHeight: 1.55 }}>
            Something at the root of the app failed to render. Reload, and if it
            keeps happening let us know.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 12,
                color: "#A1A1AA",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "12px 18px",
              background: "#18181B",
              color: "#FAFAF7",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
