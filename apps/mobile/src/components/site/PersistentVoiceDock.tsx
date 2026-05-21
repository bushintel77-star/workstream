import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@workstream/ui";
import { GARDEN_COPY } from "@workstream/domain";

export type VoiceDockMode = "idle" | "note" | "yarn";

type Props = {
  mode: VoiceDockMode;
  onYarn: () => void;
  onNote: () => void;
  onWhatsLeft: () => void;
};

export function PersistentVoiceDock({
  mode,
  onYarn,
  onNote,
  onWhatsLeft,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}
      accessibilityRole="toolbar"
      accessibilityLabel="Voice and shortcuts"
    >
      <Text style={styles.hint}>{GARDEN_COPY.voice.tapHint}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.pill, mode === "yarn" && styles.pillActive]}
          onPress={onYarn}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.voice.walkthrough}
        >
          <Text style={[styles.pillTitle, mode === "yarn" && styles.pillTitleActive]}>
            {mode === "yarn" ? GARDEN_COPY.voice.walkActive : GARDEN_COPY.voice.walkthrough}
          </Text>
          <Text style={styles.pillSub}>{GARDEN_COPY.voice.walkthroughSub}</Text>
        </Pressable>
        <Pressable
          style={[styles.pill, mode === "note" && styles.pillActive]}
          onPress={onNote}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.voice.note}
        >
          <Text style={[styles.pillTitle, mode === "note" && styles.pillTitleActive]}>
            {mode === "note" ? GARDEN_COPY.voice.noteActive : GARDEN_COPY.voice.note}
          </Text>
          <Text style={styles.pillSub}>{GARDEN_COPY.voice.noteSub}</Text>
        </Pressable>
        <Pressable
          style={styles.pillCompact}
          onPress={onWhatsLeft}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.widgets.whatsLeft}
        >
          <Text style={styles.pillCompactText}>{GARDEN_COPY.widgets.whatsLeft}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(250,250,247,0.96)",
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
    paddingHorizontal: tokens.space[3],
    paddingTop: tokens.space[2],
  },
  hint: {
    fontSize: 10,
    color: tokens.color.ink.tertiary,
    textAlign: "center",
    marginBottom: tokens.space[2],
  },
  row: {
    flexDirection: "row",
    gap: tokens.space[2],
    alignItems: "stretch",
  },
  pill: {
    flex: 1,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.space[2],
  },
  pillActive: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  pillTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: tokens.color.ink.primary,
  },
  pillTitleActive: {
    color: tokens.color.accent.ink,
  },
  pillSub: {
    fontSize: 10,
    color: tokens.color.ink.tertiary,
    marginTop: 2,
  },
  pillCompact: {
    justifyContent: "center",
    paddingHorizontal: tokens.space[3],
    backgroundColor: tokens.color.surface.inverted,
    borderRadius: tokens.radius.md,
  },
  pillCompactText: {
    fontSize: 11,
    fontWeight: "700",
    color: tokens.color.ink.inverted,
  },
});
