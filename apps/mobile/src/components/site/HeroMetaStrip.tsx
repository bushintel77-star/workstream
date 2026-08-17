import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { SiteContext } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import {
  weatherConditionFromDay,
  type WeatherCondition,
} from "@workstream/domain";
import { WeatherGlyph } from "./WeatherGlyph";

export type WeatherForecastSlice = {
  days: Array<{
    date: string;
    precipitation_mm: number;
    temp_max_c: number;
    temp_min_c: number;
    wind_max_kph: number;
  }>;
  rain_within_24h: boolean;
  wind_warning: boolean;
};

/** Pinned above the hero title band (fixed px, not % of hero height). */
const STRIP_ABOVE_TITLE_BAND = 108;

type Props = {
  siteContext: SiteContext | null;
  weather: WeatherForecastSlice | null;
  motionEnabled?: boolean;
};

function todayCondition(weather: WeatherForecastSlice): WeatherCondition {
  const d = weather.days[0];
  if (!d) return "sun";
  if (weather.rain_within_24h && d.precipitation_mm > 1) return "rain";
  if (weather.wind_warning) return "wind";
  return weatherConditionFromDay(d.precipitation_mm, d.wind_max_kph, 0);
}

export function HeroMetaStrip({
  siteContext,
  weather,
  motionEnabled = true,
}: Props) {
  const today = weather?.days[0];
  const heroCondition = weather ? todayCondition(weather) : "sun";

  return (
    <View style={styles.strip} pointerEvents="box-none">
      {weather && today ? (
        <View style={styles.weatherBlock}>
          <View style={styles.todayRow}>
            <WeatherGlyph
              condition={heroCondition}
              size={32}
              motionEnabled={motionEnabled}
            />
            <View style={styles.todayCopy}>
              <Text style={styles.todayLabel}>On site today</Text>
              <Text style={styles.todayTemp}>
                {Math.round(today.temp_max_c)}°
                <Text style={styles.todayTempLo}>
                  {" "}
                  / {Math.round(today.temp_min_c)}°
                </Text>
              </Text>
              <Text style={styles.todayMeta}>
                {today.precipitation_mm.toFixed(1)} mm ·{" "}
                {Math.round(today.wind_max_kph)} km/h
              </Text>
            </View>
            {(weather.rain_within_24h || weather.wind_warning) && (
              <View style={styles.alertPill}>
                <Text style={styles.alertText}>
                  {weather.rain_within_24h ? "Rain" : ""}
                  {weather.rain_within_24h && weather.wind_warning ? " · " : ""}
                  {weather.wind_warning ? "Wind" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {siteContext ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Text style={styles.chip}>
            {siteContext.season.label} · {siteContext.season.month}
          </Text>
          <Text style={styles.chip}>
            Sun {siteContext.sun.now_azimuth_label}{" "}
            {siteContext.sun.now_altitude_deg}°
          </Text>
          <Text style={styles.chip}>
            {siteContext.sun.sunrise_local}–{siteContext.sun.sunset_local}
          </Text>
          {siteContext.planning_badges.map((b) => (
            <Text key={b.id} style={[styles.chip, styles.chipWarn]}>
              {b.label}
            </Text>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: "absolute",
    left: tokens.space[3],
    right: tokens.space[3],
    bottom: STRIP_ABOVE_TITLE_BAND,
    gap: tokens.space[2],
    zIndex: 2,
  },
  weatherBlock: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.space[3],
    ...tokens.elevation[1],
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  todayCopy: {
    flex: 1,
    gap: 2,
  },
  todayLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
  },
  todayTemp: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  todayTempLo: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "500",
    color: tokens.color.ink.tertiary,
  },
  todayMeta: {
    fontSize: tokens.type.micro.fontSize,
    color: tokens.color.ink.secondary,
    fontVariant: ["tabular-nums"],
  },
  alertPill: {
    backgroundColor: tokens.color.accent.soft,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: tokens.color.semantic.warn,
  },
  alertText: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: tokens.color.accent.ink,
  },
  chipRow: {
    gap: tokens.space[2],
    paddingVertical: 2,
  },
  chip: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    paddingHorizontal: tokens.space[2],
    paddingVertical: 5,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
  },
  chipWarn: {
    backgroundColor: "rgba(196, 30, 30, 0.10)",
    borderColor: tokens.color.semantic.block,
    color: tokens.color.semantic.warn,
  },
});
