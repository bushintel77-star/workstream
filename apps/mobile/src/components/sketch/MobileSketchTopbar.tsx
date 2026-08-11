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
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.studioBtn, pressed && styles.pressed]}
        onPress={() => void Linking.openURL(studioUrl)}
        accessibilityRole="link"
        accessibilityLabel="Open in Studio"
        accessibilityHint="Open this project in the desktop design studio in your browser"
      >
        <Text style={styles.studioBtnText}>Open in Studio</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={onTogglePresentation}
        accessibilityRole="button"
        accessibilityLabel={presentationMode ? "Exit presentation mode" : "Enter presentation mode"}
        accessibilityHint="Hide the toolbars and show only the site plan"
        accessibilityState={{ selected: presentationMode }}
      >
        <Text style={styles.iconText}>{presentationMode ? "◉" : "◎"}</Text>
      </Pressable>
      {syncLabel ? (
        <Text
          style={styles.sync}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Sync status: ${syncLabel}`}
        >
          {syncLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: tokens.color.surface.elevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.line.hairline,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
  },
  backText: { fontSize: 20, color: tokens.color.ink.primary },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  studioBtn: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  studioBtnText: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    color: tokens.color.accent.ink,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
  },
  iconText: { color: tokens.color.ink.tertiary, fontSize: 16 },
  sync: {
    fontSize: 10,
    color: tokens.color.ink.tertiary,
    fontFamily: "monospace",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.surface.sunken,
  },
  pressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    opacity: 0.96,
  },
});
