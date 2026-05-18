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
import { Linking, Modal, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Polygon as SvgPolygon } from "react-native-svg";
import type {
  Audit,
  AuditFinding,
  Costing,
  CostScenario,
  Design,
  DesignMode,
  GapFlag,
  LineItem,
  Output,
  OutputKind,
  Override,
  Project,
  Recording,
  Survey,
} from "@construct/contracts";
import { tokens } from "@construct/ui";
import { useConstructApi } from "../../../src/lib/api";

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
  const lotDegW = Math.max(maxLng - minLng, 1e-9);
  const lotDegH = Math.max(maxLat - minLat, 1e-9);

  const lotAspect = lotDegW / lotDegH;
  const innerArea = 1 - 2 * SURVEY_INSET_PCT;
  let lotWidthPct: number;
  let lotHeightPct: number;
  if (lotAspect >= 1) {
    lotWidthPct = innerArea;
    lotHeightPct = innerArea / lotAspect;
  } else {
    lotHeightPct = innerArea;
    lotWidthPct = innerArea * lotAspect;
  }
  const lotLeftPct = (1 - lotWidthPct) / 2;
  const lotTopPct = (1 - lotHeightPct) / 2;

  const project = (lng: number, lat: number): [number, number] => {
    const xN = (lng - minLng) / lotDegW;
    const yN = (maxLat - lat) / lotDegH;
    return [
      (lotLeftPct + xN * lotWidthPct) * 100,
      (lotTopPct + yN * lotHeightPct) * 100,
    ];
  };

  const lotPoints = lotCoords
    .map(([lng, lat]) => project(lng, lat).join(","))
    .join(" ");
  const housePoints = houseCoords
    .map(([lng, lat]) => project(lng, lat).join(","))
    .join(" ");

  const edgeMidpoints: Array<{ x: number; y: number; length_m: number }> = [];
  const closedLot =
    lotCoords.length >= 2 &&
    lotCoords[0][0] === lotCoords[lotCoords.length - 1][0] &&
    lotCoords[0][1] === lotCoords[lotCoords.length - 1][1];
  const lotEdges = closedLot ? lotCoords.slice(0, -1) : lotCoords;
  for (let i = 0; i < lotEdges.length; i++) {
    const a = lotEdges[i];
    const b = lotEdges[(i + 1) % lotEdges.length];
    const [ax, ay] = project(a[0], a[1]);
    const [bx, by] = project(b[0], b[1]);
    const measurement = survey.measurements[i];
    if (!measurement) continue;
    edgeMidpoints.push({
      x: (ax + bx) / 2,
      y: (ay + by) / 2,
      length_m: measurement.length_m,
    });
  }

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

      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <SvgPolygon
          points={lotPoints}
          fill="rgba(194,65,12,0.12)"
          stroke={tokens.color.line.ink}
          strokeWidth={0.6}
          strokeLinejoin="miter"
          vectorEffect="non-scaling-stroke"
        />
        <SvgPolygon
          points={housePoints}
          fill="rgba(24,24,27,0.78)"
        />
      </Svg>

      {edgeMidpoints.map((m, i) => (
        <View
          key={i}
          style={[
            styles.edgeLabelHost,
            { left: `${m.x}%`, top: `${m.y}%` },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.edgeLabel}>{metresFormat(m.length_m)} m</Text>
        </View>
      ))}
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useConstructApi();
  const [project, setProject] = useState<Project | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveyRunning, setSurveyRunning] = useState(false);
  const [design, setDesign] = useState<Design | null>(null);
  const [designRunning, setDesignRunning] = useState(false);
  const [costings, setCostings] = useState<Costing[]>([]);
  const [costingRunning, setCostingRunning] = useState(false);
  const [scenario, setScenario] = useState<CostScenario>("standard");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [outputRunning, setOutputRunning] = useState<OutputKind | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [overrideTarget, setOverrideTarget] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [myobSending, setMyobSending] = useState(false);
  const [myobInvoice, setMyobInvoice] = useState<{
    invoice_number: string;
    mode: "live" | "dev_fallback";
    total_incl_gst: number;
  } | null>(null);
  const [pipelineSlow, setPipelineSlow] = useState(false);
  const pipelinePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pipelineSlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, recs, s, d, costs, a, outs, ovs] = await Promise.all([
        api.getProject(id),
        api.listRecordings(id),
        api.getSurvey(id),
        api.getDesign(id),
        api.listCostings(id),
        api.getAudit(id),
        api.listOutputs(id),
        api.listOverrides(id),
      ]);
      setProject(p);
      setRecordings(recs);
      setSurvey(s);
      setDesign(d);
      setCostings(costs);
      setAudit(a);
      setOutputs(outs);
      setOverrides(ovs);
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

  const stopPipelinePolling = useCallback(() => {
    if (pipelinePollRef.current) {
      clearInterval(pipelinePollRef.current);
      pipelinePollRef.current = null;
    }
    if (pipelineSlowTimerRef.current) {
      clearTimeout(pipelineSlowTimerRef.current);
      pipelineSlowTimerRef.current = null;
    }
  }, []);

  const handleRunPipeline = useCallback(async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stopPipelinePolling();
    setPipelineRunning(true);
    setPipelineSlow(false);
    setError(null);
    try {
      await api.runPipeline(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline failed");
      setPipelineRunning(false);
      return;
    }

    const start = Date.now();
    const TIMEOUT_MS = 180_000;
    const SLOW_MS = 90_000;
    pipelineSlowTimerRef.current = setTimeout(() => {
      setPipelineSlow(true);
    }, SLOW_MS);

    pipelinePollRef.current = setInterval(async () => {
      try {
        const [p, s, d, costs, a] = await Promise.all([
          api.getProject(id),
          api.getSurvey(id),
          api.getDesign(id),
          api.listCostings(id),
          api.getAudit(id),
        ]);
        setProject(p);
        setSurvey(s);
        setDesign(d);
        setCostings(costs);
        setAudit(a);
        if (a) {
          stopPipelinePolling();
          setPipelineRunning(false);
          setPipelineSlow(false);
        } else if (Date.now() - start > TIMEOUT_MS) {
          stopPipelinePolling();
          setPipelineRunning(false);
          setPipelineSlow(false);
          setError(
            "Pipeline timed out before audit completed. Tap Retry to try again.",
          );
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
  }, [api, id, stopPipelinePolling]);

  useEffect(() => stopPipelinePolling, [stopPipelinePolling]);

  const handleRunDesign = useCallback(async () => {
    if (!id) return;
    setDesignRunning(true);
    setError(null);
    try {
      const d = await api.runDesign(id);
      setDesign(d);
      const p = await api.getProject(id);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Design failed");
    } finally {
      setDesignRunning(false);
    }
  }, [api, id]);

  const handleRunCosting = useCallback(async () => {
    if (!id) return;
    setCostingRunning(true);
    setError(null);
    try {
      const cs = await api.runCosting(id);
      setCostings(cs);
      const p = await api.getProject(id);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Costing failed");
    } finally {
      setCostingRunning(false);
    }
  }, [api, id]);

  const handleRunAudit = useCallback(async () => {
    if (!id) return;
    setAuditRunning(true);
    setError(null);
    try {
      const a = await api.runAudit(id);
      setAudit(a);
      const p = await api.getProject(id);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setAuditRunning(false);
    }
  }, [api, id]);

  const openOverride = useCallback((findingIndex: number) => {
    setOverrideTarget(findingIndex);
    setOverrideReason("");
  }, []);

  const closeOverride = useCallback(() => {
    setOverrideTarget(null);
    setOverrideReason("");
  }, []);

  const submitOverride = useCallback(async () => {
    if (!id || overrideTarget == null) return;
    if (overrideReason.trim().length < 8) {
      setError("Override reason must be at least 8 characters.");
      return;
    }
    setOverrideSaving(true);
    setError(null);
    try {
      const result = await api.createOverride(id, {
        finding_index: overrideTarget,
        reason: overrideReason.trim(),
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setOverrides((prev) => [result.override, ...prev]);
      setAudit(result.audit);
      closeOverride();
    } catch (e) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      setError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setOverrideSaving(false);
    }
  }, [api, id, overrideTarget, overrideReason, closeOverride]);

  const handleSendToMyob = useCallback(async () => {
    if (!id) return;
    setMyobSending(true);
    setError(null);
    try {
      // ensure a customer link exists; for v1 we silently bind to the first
      // MYOB customer if none has been picked yet. Phase 2 wires a picker UI.
      const customers = await api.myobCustomers();
      if (customers.length === 0) {
        throw new Error("No MYOB customers available — connect MYOB first.");
      }
      await api.myobLinkProjectCustomer(id, customers[0].uid);
      const invoice = await api.myobDraftInvoice(id);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setMyobInvoice({
        invoice_number: invoice.invoice_number,
        mode: invoice.mode,
        total_incl_gst: invoice.total_incl_gst,
      });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setError(e instanceof Error ? e.message : "MYOB send failed");
    } finally {
      setMyobSending(false);
    }
  }, [api, id]);

  const handleRunOutput = useCallback(
    async (kind: OutputKind) => {
      if (!id) return;
      setOutputRunning(kind);
      setError(null);
      try {
        const o = await api.runOutput(id, kind);
        setOutputs((prev) => {
          const others = prev.filter((p) => p.kind !== kind);
          return [...others, o].sort((a, b) => a.kind.localeCompare(b.kind));
        });
        const p = await api.getProject(id);
        setProject(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Output failed");
      } finally {
        setOutputRunning(null);
      }
    },
    [api, id],
  );

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
      ) : !project ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "Not found"}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error && (
            <View style={styles.inlineErrorBanner}>
              <Text style={styles.inlineErrorText}>{error}</Text>
              <Pressable
                onPress={handleRunPipeline}
                style={styles.inlineErrorAction}
                accessibilityRole="button"
                accessibilityLabel="Retry pipeline"
              >
                <Text style={styles.inlineErrorActionText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {pipelineRunning && (
            <PipelineProgress
              survey={survey != null}
              design={design != null}
              costings={costings.length > 0}
              audit={audit != null}
              slow={pipelineSlow}
            />
          )}

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
                One tap runs the whole pipeline: survey, design, costing and
                self-audit. Or run survey only and record a walkthrough first.
              </Text>
              <Pressable
                style={[
                  styles.primaryBtnLarge,
                  pipelineRunning && { opacity: 0.85 },
                ]}
                onPress={handleRunPipeline}
                disabled={pipelineRunning || surveyRunning}
                accessibilityRole="button"
                accessibilityLabel="Run full pipeline"
                accessibilityState={{ busy: pipelineRunning }}
              >
                {pipelineRunning ? (
                  <View style={styles.runningRow}>
                    <ActivityIndicator color={tokens.color.ink.inverted} />
                    <Text style={styles.primaryBtnText}>
                      Running pipeline…
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Run full pipeline →
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={styles.secondaryBtnFull}
                onPress={handleRunSurvey}
                disabled={surveyRunning || pipelineRunning}
                accessibilityRole="button"
                accessibilityLabel="Run survey only"
                accessibilityState={{ busy: surveyRunning }}
              >
                <Text style={styles.secondaryBtnText}>
                  {surveyRunning ? "Surveying…" : "Survey only"}
                </Text>
              </Pressable>
            </View>
          )}

          {survey && (
            <DesignSection
              design={design}
              running={designRunning}
              onRun={handleRunDesign}
            />
          )}

          {design && (
            <CostSection
              costings={costings}
              scenario={scenario}
              onScenarioChange={setScenario}
              running={costingRunning}
              onRun={handleRunCosting}
            />
          )}

          {costings.length > 0 && (
            <AuditSection
              audit={audit}
              overrides={overrides}
              running={auditRunning}
              onRun={handleRunAudit}
              onOverride={openOverride}
            />
          )}

          {audit?.passed && (
            <OutputsSection
              outputs={outputs}
              running={outputRunning}
              onRun={handleRunOutput}
            />
          )}

          {audit?.passed && (
            <View style={styles.myobCard}>
              <Text style={styles.cardLabel}>MYOB</Text>
              {myobInvoice ? (
                <>
                  <Text style={styles.myobSuccess}>
                    Draft invoice {myobInvoice.invoice_number} created
                  </Text>
                  <Text style={styles.myobMeta}>
                    {myobInvoice.mode === "live" ? "Live MYOB" : "Dev fallback"}
                    {" · "}
                    {new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: "AUD",
                      maximumFractionDigits: 0,
                    }).format(myobInvoice.total_incl_gst)}{" "}
                    incl. GST
                  </Text>
                </>
              ) : (
                <Text style={styles.intakeBody}>
                  Drafts a sales invoice on the linked MYOB company file from
                  the Standard scenario costing. GST-coded, customer auto-
                  linked.
                </Text>
              )}
              <Pressable
                style={[
                  styles.primaryBtnLarge,
                  myobSending && { opacity: 0.85 },
                ]}
                onPress={handleSendToMyob}
                disabled={myobSending}
                accessibilityRole="button"
                accessibilityLabel="Send quote to MYOB"
              >
                <Text style={styles.primaryBtnText}>
                  {myobSending
                    ? "Sending…"
                    : myobInvoice
                      ? "Resend to MYOB"
                      : "Send to MYOB →"}
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
            accessibilityRole="button"
            accessibilityLabel={
              latest ? "Record walkthrough again" : "Start walkthrough"
            }
          >
            <Text style={styles.recordButtonText}>
              {latest ? "Record again" : "Start walkthrough"}
            </Text>
          </Pressable>

          {survey && (
            <Pressable
              style={styles.buildModeButton}
              onPress={() =>
                router.push({
                  pathname: "/(app)/grid-soil",
                  params: { projectId: project.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Open Grid and Soil build mode"
            >
              <Text style={styles.buildModeKicker}>BUILD MODE</Text>
              <Text style={styles.buildModeTitle}>Grid &amp; Soil →</Text>
              <Text style={styles.buildModeBody}>
                On-site dictation. Tasks and material ledger update as you
                speak.
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <Modal
        visible={overrideTarget != null}
        transparent
        animationType="slide"
        onRequestClose={closeOverride}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.cardLabel}>OVERRIDE FINDING</Text>
            {overrideTarget != null && audit?.findings[overrideTarget] && (
              <Text style={styles.findingStatement}>
                {audit.findings[overrideTarget].statement}
              </Text>
            )}
            <Text style={styles.modalHint}>
              Reason is recorded on the project ledger. Minimum 8 characters.
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              value={overrideReason}
              onChangeText={setOverrideReason}
              placeholder="e.g. Client accepts unresolved POA item, will firm up post-deposit."
              placeholderTextColor={tokens.color.ink.tertiary}
              editable={!overrideSaving}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeOverride}
                disabled={overrideSaving}
                style={styles.secondaryBtnFull}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitOverride}
                disabled={
                  overrideSaving || overrideReason.trim().length < 8
                }
                style={[
                  styles.primaryBtnLarge,
                  { flex: 1, marginTop: 0 },
                  overrideReason.trim().length < 8 && {
                    backgroundColor: tokens.color.line.strong,
                  },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {overrideSaving ? "Recording…" : "Override"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MODE_COPY: Record<DesignMode, { label: string; tone: "ok" | "warn" | "info" }> = {
  auto: { label: "AUTO-DESIGN", tone: "info" },
  gapfill: { label: "GAP-FILL", tone: "warn" },
  validate: { label: "VALIDATE", tone: "ok" },
};

function DesignSection({
  design,
  running,
  onRun,
}: {
  design: Design | null;
  running: boolean;
  onRun: () => void;
}) {
  if (!design) {
    return (
      <View style={styles.designCard}>
        <Text style={styles.cardLabel}>DESIGN</Text>
        <Text style={styles.intakeBody}>
          Generate a proposal from the walkthrough transcript and the survey.
          Mode is detected automatically.
        </Text>
        <Pressable
          style={styles.primaryBtnLarge}
          onPress={onRun}
          disabled={running}
        >
          <Text style={styles.primaryBtnText}>
            {running ? "Designing…" : "Generate design"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const mode = MODE_COPY[design.mode];
  const zones = design.proposal.zones ?? [];

  return (
    <View style={styles.designCard}>
      <View style={styles.designHeader}>
        <Text style={styles.cardLabel}>DESIGN  ·  V{design.version}</Text>
        <View style={[styles.modePill, modeToneStyle(mode.tone)]}>
          <Text style={[styles.modePillText, modeTextStyle(mode.tone)]}>
            {mode.label}
          </Text>
        </View>
      </View>

      <Text style={styles.rationale}>{design.rationale}</Text>

      {zones.map((z) => (
        <View key={z.id} style={styles.zoneBlock}>
          <Text style={styles.zoneName}>{z.name}</Text>
          <Text style={styles.zoneTreatment}>{z.treatment}</Text>
          <View style={styles.zoneCounts}>
            <ZoneCount
              label="Plants"
              value={z.plantings.reduce((s, p) => s + p.count, 0).toString()}
            />
            <ZoneCount
              label="Hard"
              value={z.hardscape
                .map((h) => `${h.qty}${h.unit}`)
                .join(" · ") || "—"}
            />
            <ZoneCount
              label="Lights"
              value={z.lighting
                .reduce((s, l) => s + l.count, 0)
                .toString()}
            />
            <ZoneCount
              label="Irrig"
              value={z.irrigation
                .map((i) => `${i.qty}${i.unit}`)
                .join(" · ") || "—"}
            />
          </View>
        </View>
      ))}

      {design.gaps.length > 0 && (
        <View style={styles.gapsBlock}>
          <Text style={styles.cardLabel}>GAPS  ·  {design.gaps.length}</Text>
          {design.gaps.map((g, i) => (
            <GapRow key={`${g.zone}-${i}`} gap={g} />
          ))}
        </View>
      )}

      <Pressable
        style={styles.secondaryBtnFull}
        onPress={onRun}
        disabled={running}
      >
        <Text style={styles.secondaryBtnText}>
          {running ? "Re-generating…" : "Re-generate design"}
        </Text>
      </Pressable>
    </View>
  );
}

function modeToneStyle(tone: "ok" | "warn" | "info") {
  switch (tone) {
    case "ok":
      return {
        backgroundColor: "rgba(21,128,61,0.22)",
        borderColor: tokens.color.semantic.ok,
      };
    case "warn":
      return {
        backgroundColor: "rgba(180,83,9,0.22)",
        borderColor: tokens.color.semantic.warn,
      };
    case "info":
      return {
        backgroundColor: "rgba(29,78,216,0.22)",
        borderColor: tokens.color.semantic.info,
      };
  }
}

function modeTextStyle(_tone: "ok" | "warn" | "info") {
  return { color: tokens.color.ink.primary };
}

function ZoneCount({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.zoneCount}>
      <Text style={styles.zoneCountLabel}>{label}</Text>
      <Text style={styles.zoneCountValue}>{value}</Text>
    </View>
  );
}

function GapRow({ gap }: { gap: GapFlag }) {
  return (
    <View style={styles.gapRow}>
      <View style={styles.gapBullet} />
      <View style={{ flex: 1 }}>
        <Text style={styles.gapDescription}>{gap.description}</Text>
        <Text style={styles.gapFill}>→ {gap.proposed_fill}</Text>
      </View>
    </View>
  );
}

function PipelineProgress({
  survey,
  design,
  costings,
  audit,
  slow,
}: {
  survey: boolean;
  design: boolean;
  costings: boolean;
  audit: boolean;
  slow?: boolean;
}) {
  const stages: Array<{ label: string; done: boolean }> = [
    { label: "Survey", done: survey },
    { label: "Design", done: design },
    { label: "Costing", done: costings },
    { label: "Audit", done: audit },
  ];
  const currentIdx = stages.findIndex((s) => !s.done);

  return (
    <View
      style={styles.pipelineBanner}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Pipeline running. ${stages.filter((s) => s.done).length} of ${stages.length} stages complete.`}
    >
      <View style={styles.pipelineHeader}>
        <View style={styles.pipelineLiveDot} />
        <Text style={styles.pipelineKicker}>
          {slow ? "STILL PROCESSING · STAY ON SCREEN" : "PIPELINE RUNNING"}
        </Text>
      </View>
      <View style={styles.pipelineStages}>
        {stages.map((s, i) => {
          const isCurrent = i === currentIdx;
          return (
            <View key={s.label} style={styles.pipelineStage}>
              <View
                style={[
                  styles.stageDot,
                  s.done && styles.stageDotDone,
                  isCurrent && styles.stageDotActive,
                ]}
              >
                {s.done ? (
                  <Text style={styles.stageCheck}>✓</Text>
                ) : isCurrent ? (
                  <ActivityIndicator
                    size="small"
                    color={tokens.color.ink.inverted}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stageLabel,
                  s.done && styles.stageLabelDone,
                  isCurrent && styles.stageLabelActive,
                ]}
              >
                {s.label}
              </Text>
              {i < stages.length - 1 && (
                <View
                  style={[
                    styles.stageConnector,
                    s.done && styles.stageConnectorDone,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const OUTPUT_ORDER: OutputKind[] = ["task_list", "schedule", "quote", "scope"];
const OUTPUT_LABEL: Record<OutputKind, { title: string; sub: string }> = {
  task_list: { title: "Task list", sub: "Site sequence for the crew" },
  schedule: { title: "Schedule", sub: "Indicative week-by-week plan" },
  quote: { title: "Client quote", sub: "Branded summary at Standard total" },
  scope: { title: "Scope (internal)", sub: "Design rationale, gaps, audit" },
  brochure: { title: "Brochure", sub: "Deferred to Phase 8" },
};

function OutputsSection({
  outputs,
  running,
  onRun,
}: {
  outputs: Output[];
  running: OutputKind | null;
  onRun: (k: OutputKind) => void;
}) {
  return (
    <View style={styles.designCard}>
      <Text style={styles.cardLabel}>OUTPUTS</Text>
      <Text style={styles.intakeBody}>
        Audit passed. Generate any of the artefacts below — each is produced
        from the same design and costing.
      </Text>
      {OUTPUT_ORDER.map((kind) => {
        const meta = OUTPUT_LABEL[kind];
        const existing = outputs.find((o) => o.kind === kind);
        const isRunning = running === kind;
        return (
          <View key={kind} style={styles.outputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.outputTitle}>{meta.title}</Text>
              <Text style={styles.outputSub}>
                {existing
                  ? `Generated · ${new Date(existing.generated_at).toLocaleDateString("en-AU")}`
                  : meta.sub}
              </Text>
            </View>
            {existing && (
              <Pressable
                onPress={() => Linking.openURL(existing.uri)}
                hitSlop={8}
                style={styles.outputViewBtn}
              >
                <Text style={styles.outputViewText}>Open</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.outputGenBtn}
              onPress={() => onRun(kind)}
              disabled={isRunning}
            >
              <Text style={styles.outputGenText}>
                {isRunning ? "…" : existing ? "Regen" : "Generate"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const CATEGORY_LABEL: Record<AuditFinding["category"], string> = {
  fidelity: "FIDELITY",
  completeness: "COMPLETENESS",
  coherence: "COHERENCE",
  cost: "COST",
  safety: "SAFETY",
  scope: "SCOPE",
};

function AuditSection({
  audit,
  overrides,
  running,
  onRun,
  onOverride,
}: {
  audit: Audit | null;
  overrides: Override[];
  running: boolean;
  onRun: () => void;
  onOverride: (findingIndex: number) => void;
}) {
  if (!audit) {
    return (
      <View style={styles.designCard}>
        <Text style={styles.cardLabel}>AUDIT</Text>
        <Text style={styles.intakeBody}>
          Self-audit checks the design against the transcript and costing for
          fidelity, completeness, coherence, cost, safety, and scope issues.
          Blocking findings prevent output generation.
        </Text>
        <Pressable
          style={styles.primaryBtnLarge}
          onPress={onRun}
          disabled={running}
        >
          <Text style={styles.primaryBtnText}>
            {running ? "Auditing…" : "Run audit"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const tone = audit.passed
    ? tokens.color.semantic.ok
    : tokens.color.semantic.block;

  return (
    <View style={styles.designCard}>
      <View style={styles.designHeader}>
        <Text style={styles.cardLabel}>AUDIT</Text>
        <Pressable
          onPress={onRun}
          disabled={running}
          hitSlop={16}
          style={styles.tertiaryHit}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryAction}>
            {running ? "Re-auditing…" : "Re-audit"}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.auditVerdict, { borderColor: tone }]}>
        <Text style={[styles.auditVerdictLabel, { color: tone }]}>
          {audit.passed ? "PASSED" : "BLOCKED"}
        </Text>
        <Text style={styles.auditVerdictMeta}>
          {audit.blocking_count} blocking · {audit.advisory_count} advisory
        </Text>
      </View>

      {audit.findings.length === 0 ? (
        <Text style={styles.intakeBody}>
          No findings. The design and costing are internally consistent and on
          scope.
        </Text>
      ) : (
        audit.findings.map((f, i) => {
          const overridden = overrides.find(
            (o) => o.audit_id === audit.id && o.finding_index === i,
          );
          return (
            <FindingRow
              key={i}
              finding={f}
              overridden={overridden}
              onOverride={
                f.severity === "blocking" && !overridden
                  ? () => onOverride(i)
                  : undefined
              }
            />
          );
        })
      )}

      {overrides.length > 0 && (
        <View style={styles.overrideLedger}>
          <Text style={styles.cardLabel}>OVERRIDE LEDGER · {overrides.length}</Text>
          {overrides.map((o) => (
            <View key={o.id} style={styles.ledgerEntry}>
              <Text style={styles.ledgerEntryHead}>
                {o.category.toUpperCase()} · {o.location} ·{" "}
                {new Date(o.created_at).toLocaleString("en-AU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Text>
              <Text style={styles.ledgerEntryReason}>{o.reason}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function FindingRow({
  finding,
  overridden,
  onOverride,
}: {
  finding: AuditFinding;
  overridden?: Override;
  onOverride?: () => void;
}) {
  const blocking = finding.severity === "blocking";
  const tone = overridden
    ? tokens.color.ink.tertiary
    : blocking
      ? tokens.color.semantic.block
      : tokens.color.semantic.warn;
  return (
    <View style={styles.findingRow}>
      <View style={[styles.findingBar, { backgroundColor: tone }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.findingHeader}>
          <Text style={[styles.findingCategory, { color: tone }]}>
            {CATEGORY_LABEL[finding.category]}
            {overridden ? " · OVERRIDDEN" : ""}
          </Text>
          <Text style={styles.findingLocation}>· {finding.location}</Text>
        </View>
        <Text
          style={[
            styles.findingStatement,
            overridden && { textDecorationLine: "line-through", color: tokens.color.ink.tertiary },
          ]}
        >
          {finding.statement}
        </Text>
        {!overridden && (
          <Text style={styles.findingAction}>→ {finding.suggested_action}</Text>
        )}
        {onOverride && (
          <Pressable onPress={onOverride} hitSlop={8} style={styles.overrideBtn}>
            <Text style={styles.overrideBtnText}>Override with reason →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const SCENARIO_ORDER: CostScenario[] = ["lean", "standard", "buffer"];
const SCENARIO_LABEL: Record<CostScenario, string> = {
  lean: "Lean",
  standard: "Standard",
  buffer: "Buffer",
};

const formatAud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

const formatAudCents = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

function CostSection({
  costings,
  scenario,
  onScenarioChange,
  running,
  onRun,
}: {
  costings: Costing[];
  scenario: CostScenario;
  onScenarioChange: (s: CostScenario) => void;
  running: boolean;
  onRun: () => void;
}) {
  if (costings.length === 0) {
    return (
      <View style={styles.designCard}>
        <Text style={styles.cardLabel}>COSTING</Text>
        <Text style={styles.intakeBody}>
          Cost the design against the rate card. Generates three scenarios:
          Lean (no lighting/irrigation, 3% contingency), Standard (5%), Buffer
          (upgraded pleach stock, engineering allowance, 8%).
        </Text>
        <Pressable
          style={styles.primaryBtnLarge}
          onPress={onRun}
          disabled={running}
        >
          <Text style={styles.primaryBtnText}>
            {running ? "Costing…" : "Generate costing"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const active =
    costings.find((c) => c.scenario === scenario) ?? costings[0];
  const provisional = active.line_items.filter((l) => l.is_provisional);
  const billable = active.line_items.filter((l) => !l.is_provisional);

  return (
    <View style={styles.designCard}>
      <View style={styles.designHeader}>
        <Text style={styles.cardLabel}>COSTING</Text>
        <Pressable
          onPress={onRun}
          disabled={running}
          hitSlop={16}
          style={styles.tertiaryHit}
          accessibilityRole="button"
        >
          <Text style={styles.tertiaryAction}>
            {running ? "Recosting…" : "Recost"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.scenarioTabs}>
        {SCENARIO_ORDER.map((s) => {
          const cost = costings.find((c) => c.scenario === s);
          const isActive = s === active.scenario;
          return (
            <Pressable
              key={s}
              style={[styles.scenarioTab, isActive && styles.scenarioTabActive]}
              onPress={() => onScenarioChange(s)}
            >
              <Text
                style={[
                  styles.scenarioTabLabel,
                  isActive && styles.scenarioTabLabelActive,
                ]}
              >
                {SCENARIO_LABEL[s]}
              </Text>
              <Text
                style={[
                  styles.scenarioTabTotal,
                  isActive && styles.scenarioTabTotalActive,
                ]}
              >
                {cost ? formatAud(cost.total) : "—"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.totalBlock}>
        <Text style={styles.totalLabel}>{SCENARIO_LABEL[active.scenario].toUpperCase()} · TOTAL EX GST + GST</Text>
        <Text style={styles.totalAmount}>{formatAudCents(active.total)}</Text>
        <Text style={styles.totalSub}>
          Subtotal {formatAudCents(active.subtotal)} · GST{" "}
          {formatAudCents(active.gst)}
        </Text>
      </View>

      <View style={styles.lineItemsBlock}>
        <Text style={styles.cardLabel}>LINE ITEMS · {billable.length}</Text>
        {billable.map((li, i) => (
          <LineItemRow key={`${li.sku}-${i}`} item={li} />
        ))}
      </View>

      {provisional.length > 0 && (
        <View style={styles.lineItemsBlock}>
          <Text style={[styles.cardLabel, { color: tokens.color.semantic.warn }]}>
            PROVISIONAL · {provisional.length} · resolve before quote
          </Text>
          {provisional.map((li, i) => (
            <LineItemRow key={`prov-${li.sku}-${i}`} item={li} provisional />
          ))}
        </View>
      )}
    </View>
  );
}

function LineItemRow({
  item,
  provisional,
}: {
  item: LineItem;
  provisional?: boolean;
}) {
  return (
    <View style={styles.lineRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineLabel} numberOfLines={2}>
          {item.label}
        </Text>
        <Text style={styles.lineMeta}>
          {item.sku} · {item.qty}
          {item.unit !== "ea" ? ` ${item.unit}` : ""} @{" "}
          {provisional ? "POA" : formatAudCents(item.rate)}
        </Text>
      </View>
      <Text
        style={[
          styles.lineTotal,
          provisional && { color: tokens.color.semantic.warn },
        ]}
      >
        {provisional ? "POA" : formatAud(item.total)}
      </Text>
    </View>
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
  edgeLabelHost: {
    position: "absolute",
    transform: [{ translateX: -22 }, { translateY: -10 }],
  },
  edgeLabel: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    fontVariant: ["tabular-nums"],
    backgroundColor: "rgba(24,24,27,0.82)",
    paddingHorizontal: tokens.space[2],
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
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
  runningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  pipelineBanner: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[4],
    backgroundColor: tokens.color.surface.inverted,
    borderRadius: tokens.radius.lg,
    gap: tokens.space[3],
  },
  inlineErrorBanner: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[4],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.semantic.block,
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  inlineErrorText: {
    flex: 1,
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.primary,
  },
  inlineErrorAction: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    minHeight: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.semantic.block,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineErrorActionText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
  },
  pipelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
  },
  pipelineLiveDot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
  },
  pipelineKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.inverted,
  },
  pipelineStages: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  pipelineStage: {
    flex: 1,
    alignItems: "center",
    gap: tokens.space[2],
    position: "relative",
  },
  stageDot: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.ink.tertiary,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  stageDotActive: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.default,
  },
  stageDotDone: {
    borderColor: tokens.color.semantic.ok,
    backgroundColor: tokens.color.semantic.ok,
  },
  stageCheck: {
    color: tokens.color.ink.inverted,
    fontSize: 14,
    fontWeight: "700",
  },
  stageLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  stageLabelActive: {
    color: tokens.color.accent.soft,
  },
  stageLabelDone: {
    color: tokens.color.ink.inverted,
  },
  stageConnector: {
    position: "absolute",
    top: 14,
    left: "65%",
    right: "-35%",
    height: 1,
    backgroundColor: tokens.color.ink.tertiary,
    zIndex: -1,
  },
  stageConnectorDone: {
    backgroundColor: tokens.color.semantic.ok,
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
  buildModeButton: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[5],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface.inverted,
    gap: tokens.space[2],
  },
  buildModeKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  buildModeTitle: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.inverted,
  },
  buildModeBody: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.tertiary,
  },
  myobCard: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[5],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    gap: tokens.space[3],
  },
  myobSuccess: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.semantic.ok,
  },
  myobMeta: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
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
  designCard: {
    marginHorizontal: tokens.space[5],
    marginTop: tokens.space[5],
    padding: tokens.space[5],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    gap: tokens.space[4],
  },
  designHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modePill: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: 4,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  rationale: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
  zoneBlock: {
    paddingTop: tokens.space[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
    gap: tokens.space[2],
  },
  zoneName: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  zoneTreatment: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
  zoneCounts: {
    flexDirection: "row",
    gap: tokens.space[4],
    marginTop: tokens.space[2],
  },
  zoneCount: {
    minWidth: 60,
  },
  zoneCountLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  zoneCountValue: {
    marginTop: 2,
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    fontVariant: ["tabular-nums"],
    color: tokens.color.ink.primary,
  },
  gapsBlock: {
    paddingTop: tokens.space[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
    gap: tokens.space[3],
  },
  gapRow: {
    flexDirection: "row",
    gap: tokens.space[3],
    alignItems: "flex-start",
  },
  gapBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: tokens.color.semantic.warn,
  },
  gapDescription: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.primary,
  },
  gapFill: {
    marginTop: tokens.space[1],
    fontSize: tokens.type.caption.fontSize,
    lineHeight: tokens.type.caption.lineHeight,
    color: tokens.color.ink.secondary,
  },
  secondaryBtnFull: {
    height: 44,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
    justifyContent: "center",
    alignItems: "center",
  },
  tertiaryAction: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  tertiaryHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  scenarioTabs: {
    flexDirection: "row",
    gap: tokens.space[2],
  },
  scenarioTab: {
    flex: 1,
    padding: tokens.space[3],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
    alignItems: "center",
    gap: 2,
  },
  scenarioTabActive: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.accent.soft,
  },
  scenarioTabLabel: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    color: tokens.color.ink.tertiary,
  },
  scenarioTabLabelActive: {
    color: tokens.color.accent.ink,
  },
  scenarioTabTotal: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: tokens.color.ink.secondary,
  },
  scenarioTabTotalActive: {
    color: tokens.color.accent.ink,
  },
  totalBlock: {
    paddingVertical: tokens.space[3],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tokens.color.line.hairline,
    alignItems: "flex-start",
    gap: 4,
  },
  totalLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  totalAmount: {
    fontSize: tokens.type.displayL.fontSize,
    fontWeight: tokens.type.displayL.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
    letterSpacing: tokens.type.displayL.letterSpacing,
  },
  totalSub: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
    fontVariant: ["tabular-nums"],
  },
  lineItemsBlock: {
    gap: tokens.space[2],
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line.hairline,
  },
  lineLabel: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  lineMeta: {
    marginTop: 2,
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  lineTotal: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: tokens.color.ink.primary,
    minWidth: 70,
    textAlign: "right",
  },
  auditVerdict: {
    padding: tokens.space[3],
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  auditVerdictLabel: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: "700",
    letterSpacing: 1,
  },
  auditVerdictMeta: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
    fontVariant: ["tabular-nums"],
  },
  findingRow: {
    flexDirection: "row",
    gap: tokens.space[3],
    alignItems: "stretch",
  },
  findingBar: {
    width: 3,
    borderRadius: 1.5,
  },
  findingHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  findingCategory: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  findingLocation: {
    fontSize: tokens.type.micro.fontSize,
    color: tokens.color.ink.tertiary,
  },
  findingStatement: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.primary,
  },
  findingAction: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
  },
  outputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
  },
  outputTitle: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  outputSub: {
    marginTop: 2,
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
  },
  outputViewBtn: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
  },
  outputViewText: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.secondary,
  },
  outputGenBtn: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
  },
  outputGenText: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
  overrideBtn: {
    marginTop: tokens.space[2],
    alignSelf: "flex-start",
  },
  overrideBtnText: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.accent.default,
  },
  overrideLedger: {
    marginTop: tokens.space[3],
    paddingTop: tokens.space[3],
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
    gap: tokens.space[3],
  },
  ledgerEntry: {
    paddingLeft: tokens.space[3],
    borderLeftWidth: 2,
    borderLeftColor: tokens.color.line.strong,
    gap: 4,
  },
  ledgerEntryHead: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  ledgerEntryReason: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24,24,27,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: tokens.color.surface.elevated,
    padding: tokens.space[5],
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    gap: tokens.space[3],
  },
  modalHint: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
  },
  modalInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
    textAlignVertical: "top",
    backgroundColor: tokens.color.surface.sunken,
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.space[3],
    marginTop: tokens.space[2],
  },
});
