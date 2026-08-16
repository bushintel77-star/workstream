import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

type Props = {
  projectId: string;
  title: string;
  onBack: () => void;
  syncLabel?: string;
  presentationMode: boolean;
  onTogglePresentation: () => void;
};

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL ?? "https://web-production-3c194.up.railway.app";

export function MobileSketchTopbar({
  projectId,
  title,
  onBack,
  syncLabel,
  presentationMode,
  onTogglePresentation,
}: Props) {
  const studioUrl = `${WEB_BASE}/projects/${projectId}/design?studio=desktop`;
  const syncTone =
    syncLabel && syncLabel.toLowerCase().includes("offline")
      ? "warn"
      : syncLabel && syncLabel.toLowerCase().includes("saving")
        ? "info"
        : "ok";

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityHint="Return to the project screen"
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>Sketch</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
            accessibilityLabel={`Sync status: ${syncLabel}`}
          >
            {syncLabel}
          </Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.studioBtn, pressed && styles.pressed]}
        onPress={() => void Linking.openURL(studioUrl)}
        accessibilityRole="link"
        accessibilityLabel="Open in Studio"
        accessibilityHint="Open this project in the desktop design studio in your browser"
      >
        <Text style={styles.studioBtnText}>Desktop</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={onTogglePresentation}
        accessibilityRole="button"
        accessibilityLabel={presentationMode ? "Exit focus mode" : "Enter focus mode"}
        accessibilityHint="Hide the toolbars and show only the site plan"
        accessibilityState={{ selected: presentationMode }}
      >
        <Text style={styles.iconText}>{presentationMode ? "◉" : "◎"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(245, 244, 239, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 102, 122, 0.14)",
    shadowColor: "#26303d",
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(79, 91, 112, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  backText: { fontSize: 18, color: "#1d2430" },
  titleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kicker: {
    fontSize: 8,
    fontFamily: "monospace",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6f7e96",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1b232d",
  },
  studioBtn: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(84, 118, 239, 0.28)",
    backgroundColor: "rgba(84, 118, 239, 0.08)",
  },
  studioBtnText: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.7,
    color: "#4668d8",
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(79, 91, 112, 0.14)",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  iconText: { color: "#198a68", fontSize: 15 },
  syncChip: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncOk: { borderColor: "rgba(25, 138, 104, 0.3)", backgroundColor: "rgba(25, 138, 104, 0.08)" },
  syncInfo: { borderColor: "rgba(70, 104, 216, 0.25)", backgroundColor: "rgba(70, 104, 216, 0.08)" },
  syncWarn: { borderColor: "rgba(211, 129, 20, 0.3)", backgroundColor: "rgba(211, 129, 20, 0.08)" },
  sync: {
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  syncOkText: { color: "#198a68" },
  syncInfoText: { color: "#4668d8" },
  syncWarnText: { color: "#b57a18" },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.96,
  },
});
