/**
 * Gold Standard 2026 — Mobile Field Bridge (AR overlay).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §4 (Mobile Field Bridge)
 *
 * "100% Camera feed with high-precision AR overlay."
 *
 * Renders the device camera feed with three AR layers:
 *   1. Staking Chips (#fbbf24) — anchored to GPS/RTK ground coordinates
 *   2. Subsurface Ghosting — translucent utility volumes below the ground plane
 *   3. Strike Alerts (#ef4444) — high-contrast alerts near verified utilities
 *
 * Implementation note: this component requires expo-camera + expo-gl (or
 * expo-three) which are not yet installed. The component is structured so it
 * can be activated by installing those packages. Until then it renders a
 * placeholder showing the spatial data that WOULD be overlaid.
 *
 * The scene-graph data comes from the same SpatialObject[] / UtilityLine[]
 * types as the web WebGL studio — it's a parallel consumer, not shared
 * component code (RN + R3F native has a different reconciler).
 */

import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";

export interface StakingChip {
  id: string;
  /** GPS latitude. */
  lat: number;
  /** GPS longitude. */
  lng: number;
  /** Label (e.g. "PT_01", "TREE_A"). */
  label: string;
  /** Whether this chip has been verified (RTK-fixed vs GPS-approximate). */
  verified: boolean;
}

export interface MobileSubsurfaceUtility {
  id: string;
  type: "gas" | "water" | "sewer" | "electric" | "comms" | "reclaimed";
  /** Start point in lat/lng. */
  startLat: number;
  startLng: number;
  /** End point in lat/lng. */
  endLat: number;
  endLng: number;
  /** Burial depth in metres. */
  depthM: number;
}

export interface MobileStrikeZone {
  id: string;
  /** Centre of the danger zone in lat/lng. */
  lat: number;
  lng: number;
  /** Radius of the alert zone in metres. */
  radiusM: number;
  /** Utility type causing the alert. */
  utilityType: "gas" | "water" | "sewer" | "electric" | "comms" | "reclaimed";
}

export interface MobileFieldBridgeProps {
  /** Staking chips to render on the AR overlay. */
  chips: StakingChip[];
  /** Subsurface utilities to ghost below the ground plane. */
  utilities: MobileSubsurfaceUtility[];
  /** Strike alert danger zones. */
  strikeZones: MobileStrikeZone[];
  /** Device GPS position (for distance calculations). */
  deviceLat: number | null;
  deviceLng: number | null;
}

const UTILITY_LABELS: Record<string, string> = {
  gas: "GAS",
  water: "WATER",
  sewer: "SEWER",
  electric: "ELECTRIC",
  comms: "COMMS",
  reclaimed: "RECLAIMED",
};

const UTILITY_COLORS: Record<string, string> = {
  gas: "#e8b000",
  water: "#1e88c7",
  sewer: "#2f8f4e",
  electric: "#d63b2f",
  comms: "#e8722f",
  reclaimed: "#8b4fc7",
};

/**
 * Haversine distance between two lat/lng points in metres.
 */
function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MobileFieldBridge({
  chips,
  utilities,
  strikeZones,
  deviceLat,
  deviceLng,
}: MobileFieldBridgeProps) {
  const [cameraActive, setCameraActive] = useState(false);

  // Check if device is within any strike zone
  const activeStrikes = useMemo(() => {
    if (deviceLat == null || deviceLng == null) return [];
    return strikeZones.filter(
      (z) => haversineM(deviceLat, deviceLng, z.lat, z.lng) <= z.radiusM,
    );
  }, [strikeZones, deviceLat, deviceLng]);

  // Distance to nearest chip
  const nearestChip = useMemo(() => {
    if (deviceLat == null || deviceLng == null || chips.length === 0) return null;
    let nearest = chips[0];
    let minDist = Infinity;
    for (const chip of chips) {
      const d = haversineM(deviceLat, deviceLng, chip.lat, chip.lng);
      if (d < minDist) {
        minDist = d;
        nearest = chip;
      }
    }
    return { chip: nearest, distanceM: minDist };
  }, [chips, deviceLat, deviceLng]);

  return (
    <View style={styles.container}>
      {/* Camera feed placeholder — expo-camera would mount here */}
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraLabel}>
          {cameraActive ? "● CAMERA LIVE" : "CAMERA OFF"}
        </Text>
        <Pressable
          style={styles.cameraButton}
          onPress={() => setCameraActive((c) => !c)}
        >
          <Text style={styles.cameraButtonText}>
            {cameraActive ? "STOP" : "START CAMERA"}
          </Text>
        </Pressable>
      </View>

      {/* AR Overlay — Strike Alerts (highest priority, top of screen) */}
      {activeStrikes.length > 0 && (
        <View style={styles.strikeAlertBanner}>
          {activeStrikes.map((strike) => (
            <View key={strike.id} style={styles.strikeAlertItem}>
              <Text style={styles.strikeAlertIcon}>⚠</Text>
              <Text style={styles.strikeAlertText}>
                STRIKE ZONE: {UTILITY_LABELS[strike.utilityType]} — {strike.radiusM}m RADIUS
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* AR Overlay — Nearest chip readout */}
      {nearestChip && (
        <View style={styles.chipReadout}>
          <Text style={styles.chipReadoutLabel}>NEAREST STAKE</Text>
          <Text style={styles.chipReadoutId}>{nearestChip.chip.label}</Text>
          <Text
            style={[
              styles.chipReadoutDistance,
              { color: nearestChip.distanceM < 1 ? "#fbbf24" : "#9aa0ac" },
            ]}
          >
            {nearestChip.distanceM < 1
              ? `${(nearestChip.distanceM * 100).toFixed(0)} cm`
              : `${nearestChip.distanceM.toFixed(1)} m`}
          </Text>
          {nearestChip.chip.verified && (
            <Text style={styles.chipVerified}>✓ RTK VERIFIED</Text>
          )}
        </View>
      )}

      {/* AR Overlay — Utility count */}
      <View style={styles.utilityPanel}>
        <Text style={styles.utilityPanelTitle}>SUBSURFACE</Text>
        {utilities.map((util) => (
          <View key={util.id} style={styles.utilityRow}>
            <View
              style={[styles.utilityDot, { backgroundColor: UTILITY_COLORS[util.type] ?? "#666" }]}
            />
            <Text style={styles.utilityLabel}>
              {UTILITY_LABELS[util.type]} · -{util.depthM.toFixed(1)}m
            </Text>
          </View>
        ))}
        {utilities.length === 0 && (
          <Text style={styles.utilityEmpty}>No utilities mapped</Text>
        )}
      </View>

      {/* AR Overlay — Chip count */}
      <View style={styles.chipPanel}>
        <Text style={styles.chipPanelTitle}>STAKES</Text>
        <Text style={styles.chipPanelCount}>
          {chips.filter((c) => c.verified).length}/{chips.length}
        </Text>
        <Text style={styles.chipPanelSub}>verified</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#101418",
  },
  cameraPlaceholder: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0c0f12",
  },
  cameraLabel: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 14,
    color: "#6b7078",
    letterSpacing: 2,
    marginBottom: 16,
  },
  cameraButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fbbf24",
    backgroundColor: "transparent",
  },
  cameraButtonText: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 13,
    fontWeight: "600",
    color: "#fbbf24",
    letterSpacing: 1,
  },
  strikeAlertBanner: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    gap: 8,
  },
  strikeAlertItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  strikeAlertIcon: {
    fontSize: 18,
    color: "#ef4444",
  },
  strikeAlertText: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
    letterSpacing: 0.5,
  },
  chipReadout: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(30, 35, 41, 0.8)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chipReadoutLabel: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7078",
    letterSpacing: 2,
  },
  chipReadoutId: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 20,
    fontWeight: "600",
    color: "#e5e2e2",
    marginTop: 2,
  },
  chipReadoutDistance: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  chipVerified: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 10,
    fontWeight: "600",
    color: "#fbbf24",
    marginTop: 4,
    letterSpacing: 1,
  },
  utilityPanel: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(30, 35, 41, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  utilityPanelTitle: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7088",
    letterSpacing: 2,
    marginBottom: 8,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  utilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  utilityLabel: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 12,
    color: "#c6c6cb",
  },
  utilityEmpty: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 11,
    color: "#6b7078",
    fontStyle: "italic",
  },
  chipPanel: {
    position: "absolute",
    top: 60,
    left: 16,
    backgroundColor: "rgba(30, 35, 41, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chipPanelTitle: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7088",
    letterSpacing: 2,
  },
  chipPanelCount: {
    fontFamily: Platform.select({ ios: "Space Grotesk", default: "monospace" }),
    fontSize: 24,
    fontWeight: "600",
    color: "#fbbf24",
  },
  chipPanelSub: {
    fontFamily: Platform.select({ ios: "Inter", default: "sans-serif" }),
    fontSize: 10,
    color: "#6b7078",
  },
});
