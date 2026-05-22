import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@workstream/ui";
import { GARDEN_COPY, type SiteNextAction } from "@workstream/domain";
import { CompactVoiceBar } from "./CompactVoiceBar";

/** Fixed thumb zone: voice (secondary) + pipeline next step (primary). */
export function ProjectBottomChrome({
  next,
  onNextAction,
  onYarn,
  onNote,
}: {
  next: SiteNextAction;
  onNextAction: () => void;
  onYarn: () => void;
  onNote: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none"
    >
      <CompactVoiceBar onYarn={onYarn} onNote={onNote} />
      <Pressable
        style={({ pressed }) => [styles.nextCard, pressed && styles.nextPressed]}
        onPress={onNextAction}
        accessibilityRole="button"
        accessibilityLabel={`${GARDEN_COPY.widgets.whatsNext}: ${next.label}`}
        accessibilityHint={GARDEN_COPY.widgetHints.whatsNext}
      >
        <Text style={styles.nextKicker}>{GARDEN_COPY.widgets.whatsNext}</Text>
        <Text style={styles.nextLabel}>{next.label}</Text>
        {next.sub ? <Text style={styles.nextSub}>{next.sub}</Text> : null}
      </Pressable>
    </View>
  );
}

/** Scroll padding so content clears the bottom chrome. */
export const PROJECT_BOTTOM_CHROME_HEIGHT = 132;

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tokens.space[4],
    paddingTop: tokens.space[2],
    backgroundColor: tokens.color.surface.base,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
  },
  nextCard: {
    minHeight: 56,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accent.default,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[4],
    justifyContent: "center",
  },
  nextPressed: {
    opacity: 0.92,
  },
  nextKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    textTransform: "uppercase",
    color: tokens.color.accent.soft,
  },
  nextLabel: {
    marginTop: 2,
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.inverted,
  },
  nextSub: {
    marginTop: 2,
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
    color: tokens.color.accent.soft,
  },
});
