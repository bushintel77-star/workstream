import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

type Props = {
  symbolCount: number;
  strokeCount: number;
  syncLabel?: string;
  tier1?: boolean;
};

export function MobileSketchStatusBar({
  symbolCount,
  strokeCount,
  syncLabel,
  tier1,
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel={`${symbolCount} symbols, ${strokeCount} strokes${syncLabel ? `, ${syncLabel}` : ""}${tier1 ? ", Tier-1 Wrights Terrace" : ""}`}>
      {tier1 ? <Text style={styles.tier1}>Tier-1 · Wrights Terrace</Text> : null}
      <Text style={styles.counts}>
        {symbolCount} symbols · {strokeCount} strokes
      </Text>
      {syncLabel ? (
        <Text
          style={styles.sync}
          accessibilityLiveRegion="polite"
        >
          {syncLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
  },
  tier1: {
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "600",
    color: tokens.color.semantic.warn,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  counts: {
    flex: 1,
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.ink.secondary,
  },
  sync: {
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.ink.tertiary,
  },
});
