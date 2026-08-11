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
    height: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.elevated,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  row: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: "row",
  },
  pill: {
    minWidth: 60,
    minHeight: 44,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.space[3],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
  },
  pillActive: {
    borderWidth: 1,
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  pillDisabled: { opacity: 0.35 },
  pillPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  label: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    color: tokens.color.ink.secondary,
  },
  labelActive: { color: tokens.color.accent.default },
  labelDisabled: { color: tokens.color.ink.tertiary },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: tokens.color.line.hairline,
    marginHorizontal: 6,
  },
});
