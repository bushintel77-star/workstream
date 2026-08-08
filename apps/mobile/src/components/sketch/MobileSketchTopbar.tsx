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
    <View style={styles.wrap}>
      <Pressable style={styles.back} onPress={onBack} accessibilityLabel="Back">
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        style={styles.studioBtn}
        onPress={() => void Linking.openURL(studioUrl)}
      >
        <Text style={styles.studioBtnText}>Open in Studio</Text>
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={onTogglePresentation}>
        <Text style={styles.iconText}>{presentationMode ? "◉" : "◎"}</Text>
      </Pressable>
      {syncLabel ? <Text style={styles.sync}>{syncLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    backgroundColor: tokens.color.surface.elevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.line.hairline,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 20, color: tokens.color.ink.primary },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  studioBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.accent.default,
  },
  studioBtnText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.accent.default,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: tokens.color.ink.tertiary, fontSize: 16 },
  sync: { fontSize: 10, color: tokens.color.ink.tertiary },
});
