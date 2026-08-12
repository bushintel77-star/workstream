import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

type Props = {
  symbolCount: number;
  strokeCount: number;
  syncLabel?: string;
  tier1?: boolean;
};

export function MobileSketchStatusBar({
  symbolCount,
  strokeCount,
  syncLabel,
  tier1,
}: Props) {
  const syncTone =
    syncLabel && syncLabel.toLowerCase().includes("offline")
      ? "warn"
      : syncLabel && syncLabel.toLowerCase().includes("saving")
        ? "info"
        : "ok";

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel={`${symbolCount} symbols, ${strokeCount} strokes${syncLabel ? `, ${syncLabel}` : ""}${tier1 ? ", Tier-1 Wrights Terrace" : ""}`}
    >
      <View style={styles.chips}>
        <View style={styles.countChip}>
          <Text style={styles.counts}>{symbolCount} symbols</Text>
        </View>
        <View style={styles.countChip}>
          <Text style={styles.counts}>{strokeCount} strokes</Text>
        </View>
        {tier1 ? (
          <View style={styles.warnChip}>
            <Text style={styles.warnText}>Tier-1 · Wrights Terrace</Text>
          </View>
        ) : null}
      </View>
      {syncLabel ? (
        <View
          style={[
            styles.syncChip,
            syncTone === "warn" && styles.syncWarn,
            syncTone === "info" && styles.syncInfo,
            syncTone === "ok" && styles.syncOk,
          ]}
        >
          <Text
            style={[
              styles.sync,
              syncTone === "warn" && styles.syncWarnText,
              syncTone === "info" && styles.syncInfoText,
              syncTone === "ok" && styles.syncOkText,
            ]}
            accessibilityLiveRegion="polite"
          >
            {syncLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(245, 244, 239, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 102, 122, 0.12)",
    shadowColor: "#26303d",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  countChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(82, 94, 116, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
  },
  warnChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(211, 129, 20, 0.32)",
    backgroundColor: "rgba(211, 129, 20, 0.08)",
  },
  warnText: {
    fontSize: 9,
    fontFamily: "monospace",
    color: "#b57a18",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  counts: {
    fontSize: 9,
    fontFamily: "monospace",
    color: "#2a3745",
    letterSpacing: 0.4,
  },
  syncChip: {
    alignSelf: "flex-start",
    minHeight: 28,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  syncOk: { borderColor: "rgba(25, 138, 104, 0.3)", backgroundColor: "rgba(25, 138, 104, 0.08)" },
  syncInfo: { borderColor: "rgba(70, 104, 216, 0.25)", backgroundColor: "rgba(70, 104, 216, 0.08)" },
  syncWarn: { borderColor: "rgba(211, 129, 20, 0.3)", backgroundColor: "rgba(211, 129, 20, 0.08)" },
  sync: {
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  syncOkText: { color: "#198a68" },
  syncInfoText: { color: "#4668d8" },
  syncWarnText: { color: "#b57a18" },
});
