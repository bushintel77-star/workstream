import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

export type MobileTool = "select" | "draw" | "place" | "measure";

type Props = {
  active: MobileTool;
  onTool: (t: MobileTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

const TOOLS: { id: MobileTool; label: string; enabled: boolean }[] = [
  { id: "select", label: "Select", enabled: true },
  { id: "draw", label: "Draw", enabled: true },
  { id: "place", label: "Place", enabled: true },
  { id: "measure", label: "Measure", enabled: true },
];

export function MobileToolStrip({
  active,
  onTool,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="toolbar" accessibilityLabel="Sketch tools">
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>Tools</Text>
        <Text style={styles.helper}>Minimal sketch rail</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.id}
            style={({ pressed }) => [
              styles.pill,
              active === t.id && styles.pillActive,
              !t.enabled && styles.pillDisabled,
              pressed && styles.pillPressed,
            ]}
            disabled={!t.enabled}
            onPress={() => t.enabled && onTool(t.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t.label} tool`}
            accessibilityHint={`Switch to ${t.label.toLowerCase()} mode`}
            accessibilityState={{ disabled: !t.enabled, selected: active === t.id }}
          >
            <Text
              style={[
                styles.label,
                active === t.id && styles.labelActive,
                !t.enabled && styles.labelDisabled,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
        <View style={styles.divider} accessibilityElementsHidden />
        <Pressable
          style={[styles.pill, !canUndo && styles.pillDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          accessibilityHint="Undo the last stroke or placement"
          accessibilityState={{ disabled: !canUndo }}
        >
          <Text style={[styles.label, !canUndo && styles.labelDisabled]}>Undo</Text>
        </Pressable>
        <Pressable
          style={[styles.pill, !canRedo && styles.pillDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
          accessibilityRole="button"
          accessibilityLabel="Redo"
          accessibilityHint="Redo the last undone stroke or placement"
          accessibilityState={{ disabled: !canRedo }}
        >
          <Text style={[styles.label, !canRedo && styles.labelDisabled]}>Redo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 102, 122, 0.14)",
    backgroundColor: "rgba(245, 244, 239, 0.92)",
    shadowColor: "#26303d",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  kicker: {
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6f7e96",
  },
  helper: {
    fontSize: 9,
    fontFamily: "monospace",
    color: "#7a8598",
  },
  row: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
    flexDirection: "row",
  },
  pill: {
    minWidth: 60,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(88, 99, 119, 0.12)",
  },
  pillActive: {
    borderColor: "rgba(70, 104, 216, 0.28)",
    backgroundColor: "rgba(70, 104, 216, 0.08)",
  },
  pillDisabled: { opacity: 0.38 },
  pillPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  label: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    color: "#2a3745",
  },
  labelActive: { color: "#4668d8" },
  labelDisabled: { color: "#7d8798" },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(88, 99, 119, 0.20)",
    marginHorizontal: 4,
  },
});
