import { useMemo } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@workstream/ui";
import {
  GARDEN_COPY,
  formatAudBand,
} from "@workstream/domain";
import type { EnvelopeBrief } from "@workstream/domain";

type Props = {
  projectId: string;
  address: string;
  clientName?: string | null;
  lat: number | null;
  lng: number | null;
  openTaskCount: number;
  envelope: EnvelopeBrief | null;
  standardTotal: number | null;
  onShowOutstanding: () => void;
  onSketch: () => void;
  onFiling: () => void;
  onReachClient: () => void;
};

function siteLabel(address: string, clientName?: string | null): string {
  const trimmed = address.trim();
  if (clientName?.trim()) return clientName.trim();
  if (!trimmed) return "Site";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

function Widget({
  label,
  value,
  hint,
  onPress,
  accent,
  wide,
}: {
  label: string;
  value: string;
  hint: string;
  onPress: () => void;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.widget,
        wide && styles.widgetWide,
        accent && styles.widgetAccent,
        pressed && styles.widgetPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={hint}
    >
      <Text style={styles.widgetLabel}>{label}</Text>
      <Text
        style={[styles.widgetValue, accent && styles.widgetValueAccent]}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </Pressable>
  );
}

export function SiteHotLinks(props: Props) {
  const router = useRouter();
  const {
    projectId,
    address,
    clientName,
    lat,
    lng,
    openTaskCount,
    envelope,
    standardTotal,
    onShowOutstanding,
    onSketch,
    onFiling,
    onReachClient,
  } = props;

  const aud = useMemo(
    () =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const outstanding =
    openTaskCount > 0
      ? GARDEN_COPY.tasks.count(openTaskCount)
      : GARDEN_COPY.tasks.none;

  const money =
    envelope && envelope.budget_mid > 0
      ? formatAudBand(envelope.budget_low, envelope.budget_high)
      : standardTotal != null
        ? aud.format(standardTotal)
        : "Run costing";

  const mapsUrl =
    lat != null && lng != null
      ? Platform.select({
          ios: `maps:?q=${lat},${lng}`,
          android: `geo:${lat},${lng}?q=${lat},${lng}`,
          default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        })
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.panelKicker}>Site status</Text>
      <View style={styles.grid}>
        <Widget
          label={GARDEN_COPY.widgets.rightJob}
          value={siteLabel(address, clientName)}
          hint={GARDEN_COPY.widgetHints.rightJob}
          onPress={() => Linking.openURL(mapsUrl!).catch(() => {})}
          wide
        />
        <Widget
          label={GARDEN_COPY.widgets.workToday}
          value={outstanding}
          hint={GARDEN_COPY.widgetHints.workToday}
          onPress={onShowOutstanding}
          accent={openTaskCount > 0}
        />
        <Widget
          label={GARDEN_COPY.widgets.money}
          value={money}
          hint={GARDEN_COPY.widgetHints.money}
          onPress={() =>
            router.push({
              pathname: "/(app)/design-studio/[id]",
              params: { id: projectId },
            })
          }
        />
      </View>
      <View style={styles.utilityRow}>
        <Pressable
          onPress={onSketch}
          style={styles.utilityBtn}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.widgets.sketch}
          accessibilityHint={GARDEN_COPY.widgetHints.sketch}
        >
          <Text style={styles.utilityText}>{GARDEN_COPY.widgets.sketch}</Text>
        </Pressable>
        <Pressable
          onPress={onFiling}
          style={styles.utilityBtn}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.widgets.filing}
          accessibilityHint={GARDEN_COPY.widgetHints.filing}
        >
          <Text style={styles.utilityText}>{GARDEN_COPY.widgets.filing}</Text>
        </Pressable>
        <Pressable
          onPress={onReachClient}
          style={styles.utilityBtn}
          accessibilityRole="button"
          accessibilityLabel={GARDEN_COPY.widgets.reachClient}
          accessibilityHint={GARDEN_COPY.widgetHints.reachClient}
        >
          <Text style={styles.utilityText}>{GARDEN_COPY.widgets.reachClient}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: tokens.space[4],
    marginTop: tokens.space[3],
    gap: tokens.space[2],
  },
  panelKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
    justifyContent: "space-between",
  },
  widget: {
    width: "48.5%",
    minHeight: 76,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.lg,
    padding: tokens.space[3],
    justifyContent: "center",
  },
  widgetWide: {
    width: "100%",
  },
  widgetAccent: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  widgetPressed: {
    opacity: 0.9,
  },
  widgetLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
  },
  widgetValue: {
    marginTop: 6,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
    lineHeight: tokens.type.body.lineHeight,
  },
  widgetValueAccent: {
    color: tokens.color.accent.ink,
  },
  utilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
  },
  utilityBtn: {
    minHeight: 44,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
    justifyContent: "center",
  },
  utilityText: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.secondary,
  },
});
