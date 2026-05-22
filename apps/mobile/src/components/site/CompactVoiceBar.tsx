import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";
import { GARDEN_COPY } from "@workstream/domain";

type Props = {
  onYarn: () => void;
  onNote: () => void;
};

/** Secondary voice row — sits directly above the next-action bar. */
export function CompactVoiceBar({ onYarn, onNote }: Props) {
  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel="Voice capture">
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        onPress={onYarn}
        accessibilityRole="button"
        accessibilityLabel={GARDEN_COPY.voice.walkthrough}
        accessibilityHint={GARDEN_COPY.voice.walkthroughSub}
      >
        <Text style={styles.pillTitle}>{GARDEN_COPY.voice.walkthrough}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        onPress={onNote}
        accessibilityRole="button"
        accessibilityLabel={GARDEN_COPY.voice.note}
        accessibilityHint={GARDEN_COPY.voice.noteSub}
      >
        <Text style={styles.pillTitle}>{GARDEN_COPY.voice.note}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: tokens.space[2],
    marginBottom: tokens.space[2],
  },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.elevated,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.space[2],
  },
  pillPressed: {
    opacity: 0.9,
    backgroundColor: tokens.color.accent.soft,
    borderColor: tokens.color.accent.default,
  },
  pillTitle: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
});
