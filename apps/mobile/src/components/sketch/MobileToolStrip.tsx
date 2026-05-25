import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

export type MobileTool = "select" | "draw" | "place" | "measure";

type Props = {
  active: MobileTool;
  onTool: (t: MobileTool) => void;
  onUndo: () => void;
  onRedo: () => void;
};

const TOOLS: { id: MobileTool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "draw", label: "Draw" },
  { id: "place", label: "Place" },
  { id: "measure", label: "Measure" },
];

export function MobileToolStrip({ active, onTool, onUndo, onRedo }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TOOLS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.pill, active === t.id && styles.pillActive]}
            onPress={() => onTool(t.id)}
          >
            <Text style={[styles.label, active === t.id && styles.labelActive]}>{t.label}</Text>
          </Pressable>
        ))}
        <View style={styles.divider} />
        <Pressable style={styles.pill} onPress={onUndo}>
          <Text style={styles.label}>Undo</Text>
        </Pressable>
        <Pressable style={styles.pill} onPress={onRedo}>
          <Text style={styles.label}>Redo</Text>
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
  label: {
    fontSize: 9,
    fontFamily: "monospace",
    color: tokens.color.ink.tertiary,
  },
  labelActive: { color: tokens.color.accent.default },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: tokens.color.line.hairline,
    marginHorizontal: 4,
  },
});
