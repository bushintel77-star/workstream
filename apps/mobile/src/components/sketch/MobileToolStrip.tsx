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
  { id: "select", label: "Select", enabled: false },
  { id: "draw", label: "Draw", enabled: true },
  { id: "place", label: "Place", enabled: true },
  { id: "measure", label: "Measure", enabled: false },
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
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.id}
            style={[
              styles.pill,
              active === t.id && styles.pillActive,
              !t.enabled && styles.pillDisabled,
            ]}
            disabled={!t.enabled}
            onPress={() => t.enabled && onTool(t.id)}
            accessibilityState={{ disabled: !t.enabled }}
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
        <View style={styles.divider} />
        <Pressable
          style={[styles.pill, !canUndo && styles.pillDisabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Text style={[styles.label, !canUndo && styles.labelDisabled]}>Undo</Text>
        </Pressable>
        <Pressable
          style={[styles.pill, !canRedo && styles.pillDisabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Text style={[styles.label, !canRedo && styles.labelDisabled]}>Redo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.elevated,
  },
  row: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
    flexDirection: "row",
  },
  pill: {
    minWidth: 52,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.color.surface.sunken,
  },
  pillActive: {
    borderWidth: 1,
    borderColor: tokens.color.accent.default,
  },
  pillDisabled: { opacity: 0.4 },
  label: {
    fontSize: 9,
    fontFamily: "monospace",
    color: tokens.color.ink.tertiary,
  },
  labelActive: { color: tokens.color.accent.default },
  labelDisabled: { color: tokens.color.ink.tertiary },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: tokens.color.line.hairline,
    marginHorizontal: 4,
  },
});
