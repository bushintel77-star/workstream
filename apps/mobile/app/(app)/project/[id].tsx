import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Project, Recording, Survey } from "@walkthrough/contracts";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../../src/lib/api";

const AERIAL_ASPECT = 1;
const SURVEY_INSET_PCT = 0.12;

function isRealAerial(uri: string): boolean {
  return uri.startsWith("http") && !uri.startsWith("https://placeholder");
}

function metresFormat(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(1);
}

function deriveSummary(survey: Survey) {
  const front = survey.measurements.find((m) => m.edge_id === "front");
  const sides = survey.measurements.filter(
    (m) => m.edge_id === "east" || m.edge_id === "west",
  );
  const frontage = front?.length_m ?? survey.measurements[0]?.length_m ?? 0;
  const depth =
    sides.length > 0
      ? sides.reduce((s, m) => s + m.length_m, 0) / sides.length
      : 0;
  return { frontage, depth };
}

function SurveyHero({ survey }: { survey: Survey }) {
  const lotCoords = survey.title_polygon.coordinates[0];
  const houseCoords = survey.house_polygon.coordinates[0];

  const lngs = lotCoords.map((c) => c[0]);
  const lats = lotCoords.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lotDegW = maxLng - minLng;
  const lotDegH = maxLat - minLat;

  const houseLngs = houseCoords.map((c) => c[0]);
  const houseLats = houseCoords.map((c) => c[1]);
  const houseMinLng = Math.min(...houseLngs);
  const houseMaxLng = Math.max(...houseLngs);
  const houseMinLat = Math.min(...houseLats);
  const houseMaxLat = Math.max(...houseLats);

  const lotAspect = lotDegW / lotDegH;

  const innerArea = 1 - 2 * SURVEY_INSET_PCT;
  let lotWidthPct = innerArea;
  let lotHeightPct = lotWidthPct / lotAspect;
  if (lotHeightPct > innerArea) {
    lotHeightPct = innerArea;
    lotWidthPct = lotHeightPct * lotAspect;
  }
  const lotLeftPct = (1 - lotWidthPct) / 2;
  const lotTopPct = (1 - lotHeightPct) / 2;

  const housePct = (lng: number, lat: number) => {
    const xPct = (lng - minLng) / lotDegW;
    const yPct = (maxLat - lat) / lotDegH;
    return { xPct, yPct };
  };
  const houseTL = housePct(houseMinLng, houseMaxLat);
  const houseBR = housePct(houseMaxLng, houseMinLat);
  const houseLeftPct = lotLeftPct + houseTL.xPct * lotWidthPct;
  const houseTopPct = lotTopPct + houseTL.yPct * lotHeightPct;
  const houseWidthPct = (houseBR.xPct - houseTL.xPct) * lotWidthPct;
  const houseHeightPct = (houseBR.yPct - houseTL.yPct) * lotHeightPct;

  const front = survey.measurements.find((m) => m.edge_id === "front");
  const back = survey.measurements.find((m) => m.edge_id === "back");
  const east = survey.measurements.find((m) => m.edge_id === "east");
  const west = survey.measurements.find((m) => m.edge_id === "west");

  return (
    <View style={styles.heroAerial}>
      {isRealAerial(survey.aerial_uri) ? (
        <Image
          source={{ uri: survey.aerial_uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
          <Text style={styles.heroPlaceholderText}>
            SATELLITE  ·  DEV MODE
          </Text>
        </View>
      )}

      <View style={styles.heroScrim} pointerEvents="none" />

      <View
        style={[
          styles.lotOverlay,
          {
            left: `${lotLeftPct * 100}%`,
            top: `${lotTopPct * 100}%`,
            width: `${lotWidthPct * 100}%`,
            height: `${lotHeightPct * 100}%`,
          },
        ]}
        pointerEvents="none"
      >
        <View style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, styles.gardenFill]} />
          <View
            style={[
              styles.houseSilhouette,
              {
                left: `${(houseLeftPct - lotLeftPct) / lotWidthPct * 100}%`,
                top: `${(houseTopPct - lotTopPct) / lotHeightPct * 100}%`,
                width: `${(houseWidthPct / lotWidthPct) * 100}%`,
                height: `${(houseHeightPct / lotHeightPct) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {front && (
        <Text style={[styles.edgeLabel, styles.edgeLabelBottom]}>
          {metresFormat(front.length_m)} m
        </Text>
      )}
      {back && (
        <Text style={[styles.edgeLabel, styles.edgeLabelTop]}>
          {metresFormat(back.length_m)} m
        </Text>
      )}
      {east && (
        <Text style={[styles.edgeLabel, styles.edgeLabelRight]}>
          {metresFormat(east.length_m)} m
        </Text>
      )}
      {west && (
        <Text style={[styles.edgeLabel, styles.edgeLabelLeft]}>
          {metresFormat(west.length_m)} m
        </Text>
      )}
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWalkthroughApi();
  const [project, setProject] = useState<Project | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveyRunning, setSurveyRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, recs, s] = await Promise.all([
        api.getProject(id),
        api.listRecordings(id),
        api.getSurvey(id),
      ]);
      setProject(p);
      setRecordings(recs);
      setSurvey(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  const handleRunSurvey = useCallback(async () => {
    if (!id) return;
    setSurveyRunning(true);
    setError(null);
    try {
      const s = await api.runSurvey(id);
      setSurvey(s);
      const p = await api.getProject(id);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Survey failed");
    } finally {
      setSurveyRunning(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingTranscript = recordings.some((r) => !r.transcript);

  useEffect(() => {
    if (!id || !pendingTranscript) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const recs = await api.listRecordings(id);
        setRecordings(recs);
      } catch {
        /* keep polling */
      }
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [api, id, pendingTranscript]);

  const latest = recordings[0];
  const summary = survey ? deriveSummary(survey) : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.color.accent.default} />
        </View>
      ) : error || !project ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "Not found"}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {survey ? (
            <>
              <SurveyHero survey={survey} />
              <View style={styles.summaryCard}>
                <Text style={styles.addressLine}>{project.address}</Text>
                <View style={styles.metricsLedger}>
                  <LedgerRow label="Lot" value={`${survey.lot_area_m2} m²`} />
                  <LedgerRow label="House" value={`${survey.house_area_m2} m²`} />
                  <LedgerRow label="Garden" value={`${survey.garden_area_m2} m²`} />
                  <View style={styles.ledgerDivider} />
                  <LedgerRow
                    label="Frontage"
                    value={`${metresFormat(summary?.frontage ?? 0)} m`}
                  />
                  <LedgerRow
                    label="Depth"
                    value={`${metresFormat(summary?.depth ?? 0)} m`}
                  />
                </View>

                <View style={styles.surveyActions}>
                  <Pressable style={styles.primaryBtn} disabled>
                    <Text style={styles.primaryBtnText}>Looks right →</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={handleRunSurvey}
                    disabled={surveyRunning}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {surveyRunning ? "Re-running…" : "Adjust"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.intakeCard}>
              <Text style={styles.kicker}>NEW PROJECT</Text>
              <Text style={styles.addressLine}>{project.address}</Text>
              <Text style={styles.intakeBody}>
                Survey will derive lot, house, and garden geometry from the
                address. Record a walkthrough at any time.
              </Text>
              <Pressable
                style={styles.primaryBtnLarge}
                onPress={handleRunSurvey}
                disabled={surveyRunning}
              >
                <Text style={styles.primaryBtnText}>
                  {surveyRunning ? "Running survey…" : "Run survey"}
                </Text>
              </Pressable>
            </View>
          )}

          {latest?.transcript ? (
            <View style={styles.transcriptCard}>
              <Text style={styles.cardLabel}>WALKTHROUGH TRANSCRIPT</Text>
              <Text style={styles.transcript}>{latest.transcript}</Text>
              {latest.transcription_confidence != null && (
                <Text style={styles.confidence}>
                  Confidence ·{" "}
                  {Math.round(latest.transcription_confidence * 100)}%
                </Text>
              )}
            </View>
          ) : latest && !latest.transcript ? (
            <View style={styles.transcriptCard}>
              <ActivityIndicator color={tokens.color.accent.default} />
              <Text style={styles.processing}>Transcribing walkthrough…</Text>
            </View>
          ) : null}

          <Pressable
            style={styles.recordButton}
            onPress={() =>
              router.push({
                pathname: "/(app)/recording",
                params: { projectId: project.id },
              })
            }
          >
            <Text style={styles.recordButtonText}>
              {latest ? "Record again" : "Start walkthrough"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={styles.ledgerLabel}>{label}</Text>
      <View style={styles.ledgerDots} />
      <Text style={styles.ledgerValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.space[5],
  },
  content: {
    paddingBottom: tokens.space[7],
  },
  heroAerial: {
    width: "100%",
    aspectRatio: AERIAL_ASPECT,
    backgroundColor: tokens.color.surface.inverted,
    overflow: "hidden",
  },
  heroPlaceholder: {
    backgroundColor: "#2A2A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderText: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(24,24,27,0.18)",
  },
  lotOverlay: {
    position: "absolute",
    borderColor: tokens.color.line.ink,
    borderWidth: 2,
  },
  gardenFill: {
    backgroundColor: "rgba(194,65,12,0.12)",
  },
  houseSilhouette: {
    position: "absolute",
    backgroundColor: "rgba(24,24,27,0.72)",
  },
  edgeLabel: {
    position: "absolute",
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(24,24,27,0.78)",
    paddingHorizontal: tokens.space[2],
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
  },
  edgeLabelTop: {
    top: tokens.space[3],
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -32 }],
  },
  edgeLabelBottom: {
    bottom: tokens.space[3],
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -32 }],
  },
  edgeLabelLeft: {
    left: tokens.space[3],
    top: "50%",
    transform: [{ translateY: -12 }],
  },
  edgeLabelRight: {
    right: tokens.space[3],
    top: "50%",
    transform: [{ translateY: -12 }],
  },
  summaryCard: {
    marginHorizontal: tokens.space[5],
    marginTop: -tokens.space[5],
    padding: tokens.space[5],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    ...tokens.elevation[1],
  },
  intakeCard: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[6],
    padding: tokens.space[5],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    gap: tokens.space[3],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  addressLine: {
    fontSize: tokens.type.displayM.fontSize,
    lineHeight: tokens.type.displayM.lineHeight,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  intakeBody: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
  metricsLedger: {
    marginTop: tokens.space[4],
    gap: tokens.space[2],
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: tokens.space[2],
  },
  ledgerLabel: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    color: tokens.color.ink.secondary,
  },
  ledgerDots: {
    flex: 1,
    height: 1,
    borderStyle: "dotted",
    borderBottomWidth: 1,
    borderColor: tokens.color.line.hairline,
  },
  ledgerValue: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  ledgerDivider: {
    height: 1,
    backgroundColor: tokens.color.line.hairline,
    marginVertical: tokens.space[2],
  },
  surveyActions: {
    flexDirection: "row",
    gap: tokens.space[3],
    marginTop: tokens.space[5],
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnLarge: {
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
    marginTop: tokens.space[3],
  },
  primaryBtnText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
  },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: tokens.space[5],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: tokens.color.ink.secondary,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
  },
  transcriptCard: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[5],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
  },
  cardLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
    marginBottom: tokens.space[3],
  },
  transcript: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.primary,
  },
  confidence: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    marginTop: tokens.space[3],
    fontVariant: ["tabular-nums"],
  },
  processing: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.secondary,
    marginTop: tokens.space[3],
  },
  recordButton: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[6],
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface.inverted,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
  errorText: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.semantic.block,
    marginBottom: tokens.space[3],
    textAlign: "center",
  },
  link: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.accent.default,
  },
});
