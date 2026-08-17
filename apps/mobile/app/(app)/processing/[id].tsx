import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ProjectStatus, StageLog } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";
import {
  buildProcessingStages,
  stageLabel,
} from "../../../src/components/processingStages";

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWorkstreamApi();

  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [transcriptionConfidence, setTranscriptionConfidence] = useState<number | null>(null);
  const [hasSurvey, setHasSurvey] = useState(false);
  const [hasDesign, setHasDesign] = useState(false);
  const [hasCosting, setHasCosting] = useState(false);
  const [hasAudit, setHasAudit] = useState(false);
  const [hasOutputs, setHasOutputs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageLogs, setStageLogs] = useState<StageLog[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [slow, setSlow] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = useCallback(async () => {
    if (!id) return;
    try {
      const [p, recs, survey, design, costings, audit] = await Promise.all([
        api.getProject(id),
        api.listRecordings(id),
        api.getSurvey(id),
        api.getDesign(id),
        api.listCostings(id),
        api.getAudit(id),
      ]);
      setStatus(p.status);
      setStageLogs(p.stage_logs ?? []);
      const recording = recs.find((r) => !!r.transcript) ?? recs[0];
      const transcript = recording?.transcript ?? "";
      setLatestTranscript(transcript);
      setTranscriptionConfidence(recording?.transcription_confidence ?? null);
      setHasTranscript(Boolean(transcript));
      setHasSurvey(survey != null);
      setHasDesign(design != null);
      setHasCosting(costings.length > 0);
      setHasAudit(audit != null);
      setHasOutputs(p.status === "outputs" || p.status === "complete");

      const failed = p.status.endsWith("_failed");
      const ready = p.status === "complete";

      if (failed || ready) {
        if (pollRef.current) clearInterval(pollRef.current);
        if (slowRef.current) clearTimeout(slowRef.current);
        if (ready) router.replace(`/(app)/project/${id}`);
      }
    } catch (e) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (slowRef.current) clearTimeout(slowRef.current);
      setError(e instanceof Error ? e.message : "Processing failed");
      void import("../../../src/lib/sentry").then(({ captureMobileError }) =>
        captureMobileError(e, { boundary: "mobile-processing-poll", id }),
      );
    }
  }, [api, id, router]);

  useEffect(() => {
    if (!id) return;
    void tick();
    slowRef.current = setTimeout(() => setSlow(true), 90_000);
    pollRef.current = setInterval(() => void tick(), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (slowRef.current) clearTimeout(slowRef.current);
    };
  }, [id, tick]);

  const failedLog = stageLogs.find((log) => !log.passed && log.status === "failed");

  const stages = buildProcessingStages({
    hasTranscript,
    hasSurvey,
    hasDesign,
    hasCosting,
    hasAudit,
    hasOutputs,
    status,
  });

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.inner}>
        <Text style={styles.kicker}>PROCESSING</Text>
        <Text style={styles.heading}>Turning your walkthrough into a job</Text>
        <Text style={styles.body}>
          Survey, design, costing and audit run automatically. Stay on this
          screen — you will land on review when ready.
        </Text>

        <View style={styles.stages}>
          {stages.map((s) => (
            <View key={s.key} style={styles.stageRow}>
              <View
                style={[
                  styles.stageDot,
                  s.done && styles.stageDotDone,
                  s.active && !s.failed && styles.stageDotActive,
                  s.failed && styles.stageDotFailed,
                ]}
              />
              <Text
                style={[
                  styles.stageLabel,
                  s.done && styles.stageLabelDone,
                  s.active && !s.failed && styles.stageLabelActive,
                  s.failed && styles.stageLabelFailed,
                ]}
              >
                {s.label}
                {s.active && !s.failed ? "…" : s.done ? " ✓" : s.failed ? " ✗" : ""}
              </Text>
            </View>
          ))}
        </View>

        {error ? null : (
          <ActivityIndicator
            size="large"
            color={tokens.color.accent.default}
            style={styles.spinner}
          />
        )}

        {transcriptionConfidence != null ? (
          <Text style={styles.confidence} accessibilityLiveRegion="polite">
            Transcription confidence: {Math.round(transcriptionConfidence * 100)}%
          </Text>
        ) : null}

        {status && status.endsWith("_failed") ? (
          <View style={styles.failureBox}>
            <Text style={styles.failureHeading}>
              {failedLog ? `${stageLabel(failedLog.stage)} needs attention` : "Processing needs attention"}
            </Text>
            {failedLog?.findings.filter((finding) => !finding.passed).map((finding) => (
              <Text key={finding.check} style={styles.failureText}>
                {finding.check}: {JSON.stringify(finding.evidence)}
              </Text>
            ))}
            {failedLog?.guard.filter((guard) => !guard.passed).map((guard) => (
              <Text key={guard.name} style={styles.failureText}>
                {guard.name}: {guard.value} must be {guard.threshold}
              </Text>
            ))}
            <Pressable
              disabled={retrying}
              onPress={async () => {
                setRetrying(true);
                setError(null);
                try {
                  await api.retryCapturePipeline(id);
                  setStatus("processing");
                  pollRef.current = setInterval(() => void tick(), 1500);
                  await tick();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Retry failed");
                  void import("../../../src/lib/sentry").then(({ captureMobileError }) =>
                    captureMobileError(e, { boundary: "mobile-processing-retry", id }),
                  );
                } finally {
                  setRetrying(false);
                }
              }}
              accessibilityRole="button"
            >
              <Text style={styles.retry}>{retrying ? "Retrying…" : "Retry from last good"}</Text>
            </Pressable>
          </View>
        ) : null}

        {slow && (
          <Text style={styles.slow}>
            Still working — large sites or cold API start can take a few
            minutes.
          </Text>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                pollRef.current = setInterval(() => void tick(), 1500);
                void tick();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.retry}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.inverted,
  },
  inner: {
    flex: 1,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[6],
    gap: tokens.space[4],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.invertedTertiary,
  },
  heading: {
    fontSize: tokens.type.displayM.fontSize,
    lineHeight: tokens.type.displayM.lineHeight,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.inverted,
  },
  body: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.invertedSecondary,
  },
  stages: {
    marginTop: tokens.space[4],
    gap: tokens.space[3],
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.color.line.strong,
  },
  stageDotDone: {
    backgroundColor: tokens.color.semantic.ok,
  },
  stageDotActive: {
    backgroundColor: tokens.color.accent.default,
  },
  stageDotFailed: {
    backgroundColor: tokens.color.semantic.block,
  },
  stageLabel: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.invertedTertiary,
  },
  stageLabelDone: {
    color: tokens.color.ink.inverted,
  },
  stageLabelActive: {
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
  stageLabelFailed: {
    color: tokens.color.semantic.block,
    fontWeight: "600",
  },
  spinner: {
    marginTop: tokens.space[6],
  },
  voiceReply: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
  },
  slow: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.invertedSecondary,
    textAlign: "center",
  },
  confidence: {
    color: tokens.color.ink.invertedTertiary,
    fontSize: tokens.type.caption.fontSize,
    textAlign: "center",
  },
  failureBox: {
    gap: tokens.space[2],
    padding: tokens.space[4],
    borderWidth: 1,
    borderColor: tokens.color.semantic.block,
    borderRadius: 8,
  },
  failureHeading: {
    color: tokens.color.ink.inverted,
    fontWeight: "700",
  },
  failureText: {
    color: tokens.color.ink.invertedSecondary,
    fontSize: tokens.type.caption.fontSize,
  },
  errorBox: {
    gap: tokens.space[2],
    alignItems: "center",
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.invertedSecondary,
    textAlign: "center",
  },
  retry: {
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
});
