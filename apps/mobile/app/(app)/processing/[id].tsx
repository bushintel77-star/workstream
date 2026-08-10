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
import type { ProjectStatus } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";

type Stage = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  failed: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  transcription: "Transcribing walkthrough",
  survey: "Surveying site",
  design: "Generating design",
  costing: "Costing scenarios",
  audit: "Self-audit",
  outputs: "Packaging outputs",
  complete: "Complete",
};

const FAILED_SUFFIX = "_failed";

function buildStages(args: {
  hasTranscript: boolean;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  hasAudit: boolean;
  hasOutputs: boolean;
  status: ProjectStatus | null;
}): Stage[] {
  const status = args.status ?? "processing";
  const order = [
    { key: "transcription", done: args.hasTranscript },
    { key: "survey", done: args.hasSurvey },
    { key: "design", done: args.hasDesign },
    { key: "costing", done: args.hasCosting },
    { key: "audit", done: args.hasAudit },
    { key: "outputs", done: args.hasOutputs },
    { key: "complete", done: status === "complete" },
  ];

  const failedKey = status.endsWith(FAILED_SUFFIX) ? status.replace(FAILED_SUFFIX, "") : null;
  const firstOpen = order.findIndex((s) => !s.done);

  return order.map((s, i) => {
    const failed = failedKey === s.key;
    const active = !s.done && (failed || i === firstOpen) && status !== "complete";
    return {
      key: s.key,
      label: STAGE_LABELS[s.key] ?? s.key,
      done: s.done,
      active,
      failed,
    };
  });
}

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWorkstreamApi();

  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [hasSurvey, setHasSurvey] = useState(false);
  const [hasDesign, setHasDesign] = useState(false);
  const [hasCosting, setHasCosting] = useState(false);
  const [hasAudit, setHasAudit] = useState(false);
  const [hasOutputs, setHasOutputs] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const transcript = recs.find((r) => !!r.transcript)?.transcript ?? "";
      setLatestTranscript(transcript);
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
        router.replace(`/(app)/project/${id}`);
      }
    } catch (e) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (slowRef.current) clearTimeout(slowRef.current);
      setError(e instanceof Error ? e.message : "Processing failed");
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

  const stages = buildStages({
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

        {status && status.endsWith("_failed") && latestTranscript ? (
          <Text style={styles.voiceReply}>
            Stage failed. Transcript still available for manual review.
          </Text>
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
    color: tokens.color.ink.tertiary,
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
    color: tokens.color.ink.tertiary,
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
    color: tokens.color.ink.tertiary,
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
    color: tokens.color.semantic.warn,
    textAlign: "center",
  },
  errorBox: {
    gap: tokens.space[2],
    alignItems: "center",
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
    textAlign: "center",
  },
  retry: {
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
});
