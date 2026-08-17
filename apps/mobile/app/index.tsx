import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buildGrowthTemporalRings, buildSpatialTruthSnapshot } from "@workstream/domain";
import { tokens } from "@workstream/ui";
import { useAppAuth } from "../src/lib/auth";
import { useEffect, useState } from "react";
import { useWorkstreamApi } from "../src/lib/api";

export default function RootIndex() {
  const { isSignedIn, isLoaded } = useAppAuth();
  const webPreview = process.env.EXPO_PUBLIC_WEB_PREVIEW === "true";

  if (webPreview) {
    return <WebPreviewHome />;
  }

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={tokens.color.accent.default} />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}

function WebPreviewHome() {
  const api = useWorkstreamApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .listProjects()
      .then((projects) => {
        if (!active) return;
        setCount(projects.length);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Preview failed");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const spatialTruth = buildSpatialTruthSnapshot([
    {
      id: "site-origin",
      layer: "topography",
      label: "Site origin anchor",
      source: "placement",
      area_m2: 0,
      length_m: 0,
      depth_m: 0,
      count: 1,
      site_origin_locked: true,
      origin_x: 0,
      origin_y: 0,
      origin_z: 0,
      strike_alert: false,
      maturity_index: 1,
    },
    {
      id: "irrigation-main",
      layer: "irrigation",
      label: "Irrigation mainline",
      source: "irrigation",
      area_m2: 0,
      length_m: 38,
      depth_m: 0.45,
      count: 1,
      gpm: 24,
      pressure_drop_kpa: 11.6,
      strike_alert: false,
      maturity_index: 0.6,
    },
    {
      id: "drainage-run",
      layer: "topography",
      label: "Drainage corridor",
      source: "cad",
      area_m2: 0,
      length_m: 18,
      depth_m: 0.72,
      count: 1,
      gpm: 9,
      pressure_drop_kpa: 6.4,
      strike_alert: true,
      maturity_index: 0.42,
    },
    {
      id: "feature-bed",
      layer: "softscape",
      label: "Feature bed",
      source: "placement",
      area_m2: 14,
      length_m: 9,
      depth_m: 0.3,
      count: 1,
      maturity_index: 0.68,
    },
  ]);

  const growthRings = buildGrowthTemporalRings({
    growth: "5yr",
    scaleM: 18,
    items: [
      { id: "ring-1", type: "canopy", x: 25, y: 50, mature_spread_m: 6 },
      { id: "ring-2", type: "canopy", x: 58, y: 50, mature_spread_m: 7 },
    ],
  });

  return (
    <View style={styles.previewShell}>
      <Text style={styles.previewMark}>CURTIS & CO</Text>
      <Text style={styles.previewTitle}>Workstream</Text>
      <Text style={styles.previewBody}>
        {loading ? "Loading projects..." : `${count} project${count === 1 ? "" : "s"} ready`}
      </Text>
      {error ? <Text style={styles.previewError}>{error}</Text> : null}
      <View style={styles.truthGrid}>
        <View style={styles.truthCard}>
          <Text style={styles.truthLabel}>Origin lock</Text>
          <Text style={styles.truthValue}>0, 0, 0</Text>
        </View>
        <View style={styles.truthCard}>
          <Text style={styles.truthLabel}>Flow</Text>
          <Text style={styles.truthValue}>{spatialTruth.totalGpm.toFixed(1)} L/min</Text>
        </View>
        <View style={styles.truthCard}>
          <Text style={styles.truthLabel}>Pressure</Text>
          <Text style={styles.truthValue}>{spatialTruth.maxPressureDropKpa.toFixed(1)} kPa</Text>
        </View>
        <View style={styles.truthCard}>
          <Text style={styles.truthLabel}>Maturity</Text>
          <Text style={styles.truthValue}>{Math.round(spatialTruth.maturityIndex * 100)}%</Text>
        </View>
      </View>
      <View style={styles.alertRow}>
        <Text style={styles.alertLabel}>Strike alerts</Text>
        <View style={styles.alertPill}>
          <Text style={styles.alertPillText}>{spatialTruth.strikeAlertCount}</Text>
        </View>
      </View>
      <View style={styles.growthRow}>
        <Text style={styles.growthLabel}>Growth ring</Text>
        <Text style={styles.growthValue}>{growthRings.length} active / 5yr</Text>
      </View>
      <Pressable style={styles.previewButton}>
        <Text style={styles.previewButtonText}>New project</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.surface.base,
  },
  previewShell: {
    flex: 1,
    padding: tokens.space[6],
    backgroundColor: tokens.color.surface.base,
    justifyContent: "center",
    gap: tokens.space[3],
  },
  previewMark: {
    fontSize: tokens.type.micro.fontSize,
    letterSpacing: tokens.type.micro.letterSpacing,
    fontWeight: tokens.type.micro.fontWeight,
    color: tokens.color.ink.tertiary,
  },
  previewTitle: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  previewBody: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.secondary,
  },
  previewError: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.semantic.block,
  },
  truthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
    marginTop: tokens.space[2],
  },
  truthCard: {
    minWidth: 120,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
  },
  truthLabel: {
    fontSize: tokens.type.micro.fontSize,
    letterSpacing: 0.4,
    color: tokens.color.ink.tertiary,
    textTransform: "uppercase",
  },
  truthValue: {
    marginTop: 4,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
    marginTop: tokens.space[2],
  },
  alertLabel: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.secondary,
  },
  alertPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.semantic.block,
  },
  alertPillText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "700",
  },
  growthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: tokens.space[2],
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(61, 90, 254, 0.08)",
  },
  growthLabel: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  growthValue: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
  previewButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accent.default,
    marginTop: tokens.space[3],
  },
  previewButtonText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
  },
});
