"use client";

import { Component, type CSSProperties, type ReactNode } from "react";
import { Button } from "./Button";

type SurfaceTone = "canvas" | "panel";

export interface StudioSurfaceErrorBoundaryProps {
  areaLabel: string;
  title: string;
  detail: string;
  tone?: SurfaceTone;
  testId?: string;
  children?: ReactNode;
}

interface StudioSurfaceErrorBoundaryState {
  failed: boolean;
  retryNonce: number;
}

interface StudioSurfaceFallbackProps {
  title: string;
  detail: string;
  tone: SurfaceTone;
  testId?: string;
  onRetry: () => void;
}

const canvasFallbackShell: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "var(--ws-canvas)",
};

const panelFallbackShell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--ws-space-4)",
  padding: "10px 11px",
  borderRadius: "var(--ws-radius-2)",
  border: "1px solid color-mix(in srgb, var(--ws-warning) 45%, transparent)",
  background: "color-mix(in srgb, var(--ws-canvas) 88%, transparent)",
};

const fallbackCard: CSSProperties = {
  width: "min(420px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--ws-space-4)",
  padding: 20,
  borderRadius: "var(--ws-radius-3)",
  border: "1px solid color-mix(in srgb, var(--ws-line) 60%, transparent)",
  background: "var(--ws-panel)",
  boxShadow: "var(--ws-shadow-1)",
  color: "var(--ws-ink)",
  fontFamily: "var(--font-ui)",
};

function StudioSurfaceFallback({
  title,
  detail,
  tone,
  testId,
  onRetry,
}: StudioSurfaceFallbackProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      data-testid={testId}
      style={tone === "canvas" ? canvasFallbackShell : panelFallbackShell}
    >
      <div style={fallbackCard}>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-tech)",
            fontSize: "var(--ws-text-lg)",
            letterSpacing: "0.02em",
            color: "var(--ws-ink)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            color: "var(--ws-ink-secondary)",
            fontSize: "var(--ws-text-xs)",
            lineHeight: 1.5,
          }}
        >
          {detail}
        </p>
        <div style={{ display: "flex", gap: "var(--ws-space-3)", flexWrap: "wrap" }}>
          <Button
            variant="ghost-line"
            onClick={onRetry}
            style={{ minHeight: 32, padding: "0 10px" }}
            aria-label="Retry this surface"
          >
            Retry surface
          </Button>
        </div>
      </div>
    </section>
  );
}

export class StudioSurfaceErrorBoundary extends Component<
  StudioSurfaceErrorBoundaryProps,
  StudioSurfaceErrorBoundaryState
> {
  state: StudioSurfaceErrorBoundaryState = { failed: false, retryNonce: 0 };

  static getDerivedStateFromError(_error: unknown) {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[webgl] ${this.props.areaLabel.toLowerCase()} crashed`, error);
  }

  private retry = () => {
    this.setState((state) => ({
      failed: false,
      retryNonce: state.retryNonce + 1,
    }));
  };

  render() {
    const tone = this.props.tone ?? "panel";
    if (this.state.failed) {
      return (
        <StudioSurfaceFallback
          tone={tone}
          title={this.props.title}
          detail={this.props.detail}
          testId={this.props.testId}
          onRetry={this.retry}
        />
      );
    }

    if (tone === "canvas") {
      return (
        <div key={this.state.retryNonce} style={{ position: "absolute", inset: 0 }}>
          {this.props.children}
        </div>
      );
    }

    return (
      <div key={this.state.retryNonce} style={{ display: "contents" }}>
        {this.props.children}
      </div>
    );
  }
}
