import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@construct/ui";
import type {
  Project,
  Survey,
  Task,
  TaskPriority,
} from "@construct/contracts";
import { useConstructApi } from "../../src/lib/api";

type LedgerEntry = {
  id: string;
  material_type: string;
  measurement_type:
    | "area_sqm"
    | "volume_cum"
    | "linear_meters"
    | "unit_count";
  quantity: number;
  zone: string | null;
  created_at: string;
};

type FeedEntry =
  | { kind: "reply"; id: string; at: string; text: string }
  | { kind: "task"; id: string; at: string; task: Task }
  | { kind: "ledger"; id: string; at: string; entry: LedgerEntry };

type AmbientState = "idle" | "filtering" | "processing";

const MEASUREMENT_LABEL: Record<LedgerEntry["measurement_type"], string> = {
  area_sqm: "m²",
  volume_cum: "m³",
  linear_meters: "lm",
  unit_count: "ea",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  critical: tokens.color.semantic.block,
  high: tokens.color.semantic.warn,
  medium: tokens.color.semantic.info,
  low: tokens.color.ink.tertiary,
};

function formatQuantity(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export default function GridSoilScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const api = useConstructApi();

  const [project, setProject] = useState<Project | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transcript, setTranscript] = useState("");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [ambient, setAmbient] = useState<AmbientState>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ambientAnim = useRef(new Animated.Value(0)).current;

  // ----- Load context -----------------------------------------------------
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, s, t] = await Promise.all([
          api.getProject(projectId),
          api.getSurvey(projectId),
          api.listTasks(projectId),
        ]);
        if (cancelled) return;
        setProject(p);
        setSurvey(s);
        setTasks(t);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load project");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, projectId]);

  // ----- Ambient status animation -----------------------------------------
  useEffect(() => {
    if (ambient === "idle") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ambientAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ambientAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    if (ambient === "processing") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ambientAnim, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ambientAnim, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    ambientAnim.setValue(0.25);
    return undefined;
  }, [ambient, ambientAnim]);

  const ambientDotStyle = useMemo(
    () => ({
      opacity: ambientAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.32, 1],
      }),
      transform: [
        {
          scale: ambientAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.85, 1.15],
          }),
        },
      ],
    }),
    [ambientAnim],
  );

  const ambientLabel =
    ambient === "idle"
      ? "LISTENING"
      : ambient === "filtering"
        ? "FILTERING NOISE"
        : "UPDATING MANIFEST";

  // ----- Submit dictation -------------------------------------------------
  const canSubmit =
    !!projectId &&
    transcript.trim().length >= 8 &&
    ambient !== "processing";

  async function submit() {
    if (!projectId || !canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAmbient("processing");
    setError(null);
    const draft = transcript.trim();
    setTranscript("");
    try {
      const result = await api.runDictation(projectId, draft);
      const now = new Date().toISOString();
      const newEntries: FeedEntry[] = [];
      newEntries.push({
        kind: "reply",
        id: `reply-${now}`,
        at: now,
        text: result.reply,
      });
      for (const ev of result.events) {
        if (ev.kind === "task_created") {
          // hydrate from list to get full row (status etc.)
          newEntries.push({
            kind: "task",
            id: ev.task_id,
            at: now,
            task: {
              id: ev.task_id,
              project_id: projectId,
              title: ev.payload.title,
              assignee_name: ev.payload.assignee_name ?? null,
              priority: ev.payload.priority ?? "medium",
              technical_specifications:
                ev.payload.technical_specifications ?? null,
              status: "pending",
              source: "dictation",
              created_at: now,
            },
          });
        } else {
          newEntries.push({
            kind: "ledger",
            id: ev.entry.id,
            at: now,
            entry: ev.entry,
          });
        }
      }
      setFeed((prev) => [...newEntries.reverse(), ...prev]);
      const refreshedTasks = await api.listTasks(projectId);
      setTasks(refreshedTasks);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setError(e instanceof Error ? e.message : "Dictation failed");
    } finally {
      setAmbient("idle");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.containerDark}>
        <ActivityIndicator size="large" color={tokens.color.accent.default} />
      </SafeAreaView>
    );
  }

  if (!projectId || !project) {
    return (
      <SafeAreaView style={styles.containerDark}>
        <Text style={styles.permBody}>
          {error ?? "Project not found."}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.ghostBtn}
        >
          <Text style={styles.ghostBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const kickoff = useMemo(() => {
    const area =
      survey?.garden_area_m2 ?? survey?.lot_area_m2 ?? null;
    const lotLine = area
      ? `${area} m² ${survey?.garden_area_m2 ? "garden" : "lot"} mapped at ${project.address}.`
      : `${project.address}.`;
    return `I have the site title and council plans imported. ${lotLine} Let's do a quick walkthrough — tell me what you're visualising, rough numbers, high-level. I'll map the preliminary tasks, costings and crew assignments in the background as you speak.

Whenever you're ready, I'm listening.`;
  }, [project.address, survey]);

  return (
    <SafeAreaView style={styles.containerDark} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close Grid and Soil"
            hitSlop={16}
            style={styles.closeHit}
          >
            <Text style={styles.closeLabel}>CLOSE</Text>
          </Pressable>
          <View style={styles.ambientRow}>
            <Animated.View style={[styles.ambientDot, ambientDotStyle]} />
            <Text style={styles.ambientLabel} accessibilityLiveRegion="polite">
              {ambientLabel}
            </Text>
          </View>
          <View style={styles.topBarRight} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.feedContent}
          keyboardShouldPersistTaps="handled"
        >
          {feed.length === 0 ? (
            <View style={styles.kickoffCard}>
              <Text style={styles.kicker}>GRID & SOIL</Text>
              <Text style={styles.kickoffBody}>{kickoff}</Text>
              <View style={styles.kickoffMetricsRow}>
                {survey?.lot_area_m2 != null && (
                  <KickoffMetric label="LOT" value={`${survey.lot_area_m2} m²`} />
                )}
                {survey?.garden_area_m2 != null && (
                  <KickoffMetric
                    label="GARDEN"
                    value={`${survey.garden_area_m2} m²`}
                  />
                )}
                {tasks.length > 0 && (
                  <KickoffMetric label="OPEN TASKS" value={String(tasks.length)} />
                )}
              </View>
            </View>
          ) : (
            feed.map((entry) => <FeedRow key={entry.id} entry={entry} />)
          )}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Mick to trench the western boundary 300mm deep before the rain. Paving area 6 by 6 metres, 24 lineal of Bluestone copers for the edge."
            placeholderTextColor={tokens.color.ink.tertiary}
            multiline
            autoCapitalize="sentences"
            editable={ambient !== "processing"}
          />
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[
              styles.composerSubmit,
              !canSubmit && styles.composerSubmitDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send to Grid and Soil"
            accessibilityState={{
              disabled: !canSubmit,
              busy: ambient === "processing",
            }}
          >
            {ambient === "processing" ? (
              <ActivityIndicator color={tokens.color.ink.inverted} />
            ) : (
              <Text style={styles.composerSubmitText}>SEND →</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KickoffMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kickoffMetric}>
      <Text style={styles.kickoffMetricLabel}>{label}</Text>
      <Text style={styles.kickoffMetricValue}>{value}</Text>
    </View>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  if (entry.kind === "reply") {
    return (
      <View style={styles.replyRow}>
        <Text style={styles.replyKicker}>GRID & SOIL</Text>
        <Text style={styles.replyText}>{entry.text}</Text>
      </View>
    );
  }
  if (entry.kind === "task") {
    const tone = PRIORITY_TONE[entry.task.priority];
    return (
      <View style={styles.feedCard}>
        <View style={styles.feedCardHead}>
          <Text style={styles.feedKicker}>TASK · {entry.task.priority.toUpperCase()}</Text>
          <View style={[styles.priorityDot, { backgroundColor: tone }]} />
        </View>
        <Text style={styles.feedTitle}>{entry.task.title}</Text>
        {entry.task.assignee_name && (
          <Text style={styles.feedMeta}>
            ASSIGNED · {entry.task.assignee_name.toUpperCase()}
          </Text>
        )}
        {entry.task.technical_specifications && (
          <Text style={styles.feedBody}>
            {entry.task.technical_specifications}
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedCardHead}>
        <Text style={styles.feedKicker}>LEDGER</Text>
        <View
          style={[styles.priorityDot, { backgroundColor: tokens.color.accent.default }]}
        />
      </View>
      <Text style={styles.feedTitle}>{entry.entry.material_type}</Text>
      <Text style={styles.feedMetricLine}>
        {formatQuantity(entry.entry.quantity)}{" "}
        {MEASUREMENT_LABEL[entry.entry.measurement_type]}
        {entry.entry.zone ? `  ·  ${entry.entry.zone}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  containerDark: {
    flex: 1,
    backgroundColor: tokens.color.surface.inverted,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
    paddingBottom: tokens.space[3],
  },
  topBarRight: {
    width: 60,
  },
  closeHit: {
    minWidth: 60,
    minHeight: 44,
    justifyContent: "center",
  },
  closeLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  ambientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
  },
  ambientDot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
  },
  ambientLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.inverted,
  },
  feedContent: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[5],
    gap: tokens.space[3],
  },
  kickoffCard: {
    padding: tokens.space[5],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: tokens.space[3],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  kickoffBody: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.inverted,
  },
  kickoffMetricsRow: {
    flexDirection: "row",
    gap: tokens.space[5],
    marginTop: tokens.space[2],
  },
  kickoffMetric: {
    gap: 2,
  },
  kickoffMetricLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  kickoffMetricValue: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: tokens.color.ink.inverted,
  },
  replyRow: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderLeftWidth: 2,
    borderLeftColor: tokens.color.accent.default,
    gap: 4,
  },
  replyKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  replyText: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.inverted,
  },
  feedCard: {
    padding: tokens.space[4],
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: tokens.space[2],
  },
  feedCardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.pill,
  },
  feedTitle: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.inverted,
  },
  feedMeta: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  feedBody: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.tertiary,
  },
  feedMetricLine: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: tokens.color.ink.inverted,
  },
  errorBanner: {
    padding: tokens.space[3],
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(185,28,28,0.16)",
    borderLeftWidth: 3,
    borderLeftColor: tokens.color.semantic.block,
  },
  errorBannerText: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.inverted,
  },
  composer: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
    paddingBottom: tokens.space[4],
    gap: tokens.space[3],
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  composerInput: {
    minHeight: 84,
    maxHeight: 168,
    padding: tokens.space[3],
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: tokens.radius.md,
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    textAlignVertical: "top",
  },
  composerSubmit: {
    height: 52,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  composerSubmitDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  composerSubmitText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    letterSpacing: 1,
    color: tokens.color.ink.inverted,
  },
  permBody: {
    color: tokens.color.ink.tertiary,
    textAlign: "center",
    marginTop: tokens.space[7],
    paddingHorizontal: tokens.space[5],
    fontSize: tokens.type.body.fontSize,
  },
  ghostBtn: {
    marginTop: tokens.space[5],
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  ghostBtnText: {
    color: tokens.color.accent.default,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
  },
});
