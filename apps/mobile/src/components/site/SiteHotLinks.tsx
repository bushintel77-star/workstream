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
  type SiteNextAction,
} from "@workstream/domain";
import type { SiteContext } from "@workstream/contracts";
import type { EnvelopeBrief } from "@workstream/domain";

type Props = {
  projectId: string;
  address: string;
  clientName?: string | null;
  clientEmail?: string | null;
  lat: number | null;
  lng: number | null;
  next: SiteNextAction;
  openTaskCount: number;
  siteContext: SiteContext | null;
  weatherRain: boolean;
  weatherWind: boolean;
  envelope: EnvelopeBrief | null;
  standardTotal: number | null;
  onWhatsApp: () => void;
  onShowOutstanding: () => void;
  onNextAction: () => void;
};

function Widget({
  label,
  value,
  onPress,
  accent,
}: {
  label: string;
  value: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.widget,
        accent && styles.widgetAccent,
        pressed && styles.widgetPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.widgetLabel}>{label}</Text>
      <Text style={[styles.widgetValue, accent && styles.widgetValueAccent]} numberOfLines={2}>
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
    clientEmail,
    lat,
    lng,
    next,
    openTaskCount,
    siteContext,
    weatherRain,
    weatherWind,
    envelope,
    standardTotal,
    onWhatsApp,
    onShowOutstanding,
    onNextAction,
  } = props;

  const workToday = weatherRain
    ? GARDEN_COPY.weather.rain
    : weatherWind
      ? GARDEN_COPY.weather.wind
      : GARDEN_COPY.weather.sweet;

  const money =
    envelope && envelope.budget_mid > 0
      ? new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
          maximumFractionDigits: 0,
        }).format(envelope.budget_low) +
        "–" +
        new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
          maximumFractionDigits: 0,
        }).format(envelope.budget_high)
      : standardTotal != null
        ? new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
            maximumFractionDigits: 0,
          }).format(standardTotal)
        : "Run costing";

  const bite =
    siteContext?.planning_badges
      .slice(0, 2)
      .map((b) => b.label)
      .join(" · ") || "All clear for now";

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
      <Pressable style={styles.nextCard} onPress={onNextAction}>
        <Text style={styles.nextKicker}>{GARDEN_COPY.widgets.whatsNext}</Text>
        <Text style={styles.nextLabel}>{next.label}</Text>
        {next.sub ? <Text style={styles.nextSub}>{next.sub}</Text> : null}
      </Pressable>

      <View style={styles.grid}>
        <Widget
          label={GARDEN_COPY.widgets.rightJob}
          value={clientName ? `${clientName}` : address.split(",")[0] ?? address}
          onPress={() => Linking.openURL(mapsUrl!).catch(() => {})}
        />
        <Widget
          label={GARDEN_COPY.widgets.workToday}
          value={workToday}
          onPress={onShowOutstanding}
        />
        <Widget
          label={GARDEN_COPY.widgets.money}
          value={money}
          onPress={() =>
            router.push({
              pathname: "/(app)/design-studio/[id]",
              params: { id: projectId },
            })
          }
        />
        <Widget
          label={GARDEN_COPY.widgets.whatsLeft}
          value={GARDEN_COPY.tasks.count(openTaskCount)}
          onPress={onShowOutstanding}
          accent={openTaskCount > 0}
        />
        <Widget
          label={GARDEN_COPY.widgets.biteLater}
          value={bite}
          onPress={onShowOutstanding}
        />
        <Widget
          label={GARDEN_COPY.widgets.reachClient}
          value={clientEmail ?? "Add email"}
          onPress={onWhatsApp}
        />
        <Widget
          label={GARDEN_COPY.widgets.sketch}
          value="On the aerial"
          onPress={() =>
            router.push({
              pathname: "/(app)/design-studio/[id]",
              params: { id: projectId },
            })
          }
        />
        <Widget
          label={GARDEN_COPY.widgets.filing}
          value="Swipe gallery"
          onPress={() =>
            router.push({
              pathname: "/(app)/filing/[id]",
              params: { id: projectId },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: tokens.space[3],
    gap: tokens.space[3],
  },
  nextCard: {
    backgroundColor: tokens.color.accent.default,
    borderRadius: tokens.radius.md,
    padding: tokens.space[4],
  },
  nextKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: tokens.color.accent.soft,
  },
  nextLabel: {
    marginTop: tokens.space[1],
    fontSize: 18,
    fontWeight: "700",
    color: tokens.color.ink.inverted,
  },
  nextSub: {
    marginTop: tokens.space[1],
    fontSize: 13,
    color: "rgba(250,250,247,0.85)",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
  },
  widget: {
    width: "48%",
    minHeight: 72,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
    justifyContent: "center",
  },
  widgetAccent: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  widgetPressed: {
    opacity: 0.88,
  },
  widgetLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
  },
  widgetValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  widgetValueAccent: {
    color: tokens.color.accent.ink,
  },
});
