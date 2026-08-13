import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";

type Tone = "gold" | "blue" | "conflict";

type Props = {
  label: string;
  botanicalName?: string | null;
  matureHeightM?: number | null;
  matureSpreadM?: number | null;
  conflict?: boolean;
  tone?: Tone;
};

/**
 * Progressive-disclosure meta chip — real catalogue data (mature height /
 * spread, botanical name) surfaced only when a placement is selected, being
 * placed, or flagged in a conflict state. Mirrors the intelligent-canvas
 * brief's "Meta Chips" pattern and apps/web's MetaChip, adapted for RN.
 * Never shown by default — the plan stays uncluttered until asked.
 */
export function PlantMetaChip({
  label,
  botanicalName,
  matureHeightM,
  matureSpreadM,
  conflict = false,
  tone = "blue",
}: Props) {
  const resolvedTone: Tone = conflict ? "conflict" : tone;
  const metaLine = [
    matureHeightM ? `H ${matureHeightM.toFixed(1)}m` : null,
    matureSpreadM ? `R ${(matureSpreadM / 2).toFixed(1)}m` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.chip, toneStyle[resolvedTone]]}>
      <Text style={[styles.label, toneText[resolvedTone]]} numberOfLines={1}>
        {label}
      </Text>
      {botanicalName ? (
        <Text style={styles.botanical} numberOfLines={1}>
          {botanicalName}
        </Text>
      ) : null}
      {metaLine ? (
        <Text style={styles.meta} numberOfLines={1}>
          {metaLine}
        </Text>
      ) : null}
      {conflict ? (
        <Text style={styles.conflictLabel} numberOfLines={1}>
          Root conflict at maturity
        </Text>
      ) : null}
    </View>
  );
}

const toneStyle = StyleSheet.create({
  gold: { borderColor: tokens.color.studio.gold },
  blue: { borderColor: tokens.color.studio.signalBlue },
  conflict: { borderColor: tokens.color.studio.conflict },
});

const toneText = StyleSheet.create({
  gold: { color: tokens.color.studio.gold },
  blue: { color: tokens.color.studio.signalBlueInk },
  conflict: { color: tokens.color.studio.conflict },
});

const styles = StyleSheet.create({
  chip: {
    minWidth: 120,
    maxWidth: 220,
    padding: 8,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    gap: 2,
    backgroundColor: "rgba(15, 17, 21, 0.88)",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  botanical: {
    fontSize: 10,
    fontStyle: "italic",
    color: tokens.color.ink.secondary,
  },
  meta: {
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.ink.secondary,
  },
  conflictLabel: {
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
    color: tokens.color.studio.conflict,
    textTransform: "uppercase",
  },
});
