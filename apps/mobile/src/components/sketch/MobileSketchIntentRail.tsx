import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

type Tone = "info" | "ok" | "warn" | "block";

type Props = {
  onVoiceBrief: () => void;
  onAiSweep: () => void;
  statusLabel?: string;
  statusTone?: Tone;
};

const TONE_STYLES: Record<Tone, { borderColor: string; backgroundColor: string; color: string }> = {
  info: {
    borderColor: tokens.color.semantic.info,
    backgroundColor: "rgba(80, 140, 255, 0.12)",
    color: tokens.color.semantic.info,
  },
  ok: {
    borderColor: tokens.color.semantic.ok,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    color: tokens.color.semantic.ok,
  },
  warn: {
    borderColor: tokens.color.semantic.warn,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    color: tokens.color.semantic.warn,
  },
  block: {
    borderColor: tokens.color.semantic.block,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    color: tokens.color.semantic.block,
  },
};

export function MobileSketchIntentRail({
  onVoiceBrief,
  onAiSweep,
  statusLabel,
  statusTone = "info",
}: Props) {
  const tone = TONE_STYLES[statusTone];

  return (
    <View style={styles.rail} accessibilityRole="toolbar" accessibilityLabel="Sketch intent">
      <View style={styles.copy}>
        <Text style={styles.kicker}>Voice-first</Text>
        <Text style={styles.title}>Say it, sketch it, let AI carry the structure.</Text>
        <Text style={styles.sub}>Progressive disclosure · technical detail only when needed</Text>
      </View>
      <View style={styles.actions}>
        {statusLabel ? (
          <View
            style={[
              styles.statusPill,
              {
                borderColor: tone.borderColor,
                backgroundColor: tone.backgroundColor,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: tone.color }]}>{statusLabel}</Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.pill, styles.voice, pressed && styles.pressed]}
          onPress={onVoiceBrief}
          accessibilityRole="button"
          accessibilityLabel="Voice brief"
          accessibilityHint="Open the voice capture flow for a quick site brief"
        >
          <Text style={[styles.pillText, styles.voiceText]}>Voice brief</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.pill, styles.ai, pressed && styles.pressed]}
          onPress={onAiSweep}
          accessibilityRole="button"
          accessibilityLabel="AI sweep"
          accessibilityHint="Run an AI sweep for placement hints"
        >
          <Text style={[styles.pillText, styles.aiText]}>AI sweep</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: "rgba(245, 244, 239, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(90, 102, 122, 0.12)",
    shadowColor: "#26303d",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  copy: {
    gap: 2,
  },
  kicker: {
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6f7e96",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1b232d",
  },
  sub: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#7a8598",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  statusPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  voice: {
    borderColor: "rgba(70, 104, 216, 0.28)",
    backgroundColor: "rgba(70, 104, 216, 0.08)",
  },
  ai: {
    borderColor: "rgba(25, 138, 104, 0.28)",
    backgroundColor: "rgba(25, 138, 104, 0.08)",
  },
  pillText: {
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  voiceText: { color: "#4668d8" },
  aiText: { color: "#198a68" },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.94,
  },
});
