import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import type { Project, ProjectStatus } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../src/lib/api";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  recording: "Recording",
  processing: "Processing",
  transcribed: "Transcribed",
  transcription_failed: "Transcription failed",
  survey_review: "Survey review",
  survey_failed: "Survey failed",
  design_review: "Design review",
  design_failed: "Design failed",
  cost_review: "Cost review",
  costing_failed: "Costing failed",
  audit: "Audit",
  audit_failed: "Audit failed",
  outputs: "Outputs",
  outputs_failed: "Outputs failed",
  complete: "Complete",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  draft: tokens.color.ink.tertiary,
  recording: tokens.color.accent.bright,
  processing: tokens.color.accent.bright,
  transcribed: tokens.color.accent.bright,
  transcription_failed: tokens.color.semantic.block,
  survey_review: tokens.color.accent.bright,
  survey_failed: tokens.color.semantic.block,
  design_review: tokens.color.accent.bright,
  design_failed: tokens.color.semantic.block,
  cost_review: tokens.color.accent.bright,
  costing_failed: tokens.color.semantic.block,
  audit: tokens.color.accent.bright,
  audit_failed: tokens.color.semantic.block,
  outputs: tokens.color.semantic.ok,
  outputs_failed: tokens.color.semantic.block,
  complete: tokens.color.semantic.ok,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function HomeScreen() {
  const router = useRouter();
  const api = useWorkstreamApi();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = useCallback(
    (project: Project) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
      Alert.alert(
        "Delete project?",
        `${project.address}\n\nThe project moves to trash and can be restored from the web dashboard.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              ).catch(() => { });
              try {
                await api.deleteProject(project.id);
                setProjects((prev) =>
                  prev.filter((p) => p.id !== project.id),
                );
              } catch (e) {
                Alert.alert(
                  "Delete failed",
                  e instanceof Error ? e.message : "Unknown error",
                );
              }
            },
          },
        ],
      );
    },
    [api],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Masthead */}
      <View style={styles.masthead}>
        <Text style={styles.mastheadMark}>CURTIS &amp; CO</Text>
        <Text style={styles.mastheadSub}>Workstream</Text>
      </View>

      <View style={styles.rule} />

      {/* Index header */}
      <View style={styles.indexHeader}>
        <Text style={styles.indexLabel}>
          {loading ? "Loading" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        </Text>
        <Pressable
          onPress={() => router.push("/(app)/settings")}
          hitSlop={16}
          accessibilityRole="link"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.indexAction}>Settings</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={tokens.color.ink.tertiary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} hitSlop={16}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyBody}>
            Start a project by entering an address.{"\n"}The walkthrough is the brief.
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.rowRule} />}
          renderItem={({ item, index }) => {
            const statusLabel = STATUS_LABEL[item.status];
            const dotColor = STATUS_DOT[item.status];
            const date = new Date(item.created_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => router.push(`/(app)/project/${item.id}`)}
                onLongPress={() => confirmDelete(item)}
                delayLongPress={400}
                accessibilityRole="button"
                accessibilityLabel={`${item.address}, ${statusLabel}`}
                accessibilityHint="Double tap to open, long press to delete"
              >
                {/* Index number — architectural drawing reference */}
                <Text style={styles.rowIndex} allowFontScaling={false}>
                  {pad2(index + 1)}
                </Text>

                {/* Address — editorial hero text */}
                <View style={styles.rowBody}>
                  <Text style={styles.rowAddress} numberOfLines={2}>
                    {item.address}
                  </Text>
                  <View style={styles.rowMeta}>
                    <View style={styles.statusGroup}>
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                      <Text style={styles.statusText}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.rowDate}>{date}</Text>
                  </View>
                </View>

                {/* Arrow — minimal directional cue */}
                <Text style={styles.rowArrow} allowFontScaling={false}>
                  {"\u2192"}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Bottom bar — replaces FAB with an editorial footer */}
      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <Pressable
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.footerButtonPressed,
          ]}
          onPress={() => router.push("/(app)/new-project")}
          accessibilityRole="button"
          accessibilityLabel="New project"
        >
          <Text style={styles.footerPlus}>+</Text>
          <Text style={styles.footerLabel}>New project</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const HAIRLINE = tokens.color.line.hairline;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },

  // --- Masthead ---
  masthead: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[3],
  },
  mastheadMark: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: tokens.color.ink.secondary,
  },
  mastheadSub: {
    fontFamily: tokens.font.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "400",
    color: tokens.color.ink.primary,
    marginTop: 2,
  },

  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginHorizontal: tokens.space[5],
  },

  // --- Index header ---
  indexHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: tokens.space[5],
    paddingVertical: tokens.space[3],
  },
  indexLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: tokens.color.ink.tertiary,
    textTransform: "uppercase",
  },
  indexAction: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: tokens.color.ink.secondary,
    textTransform: "uppercase",
  },

  // --- List ---
  list: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[8],
  },
  rowRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: tokens.space[4],
    gap: tokens.space[3],
    minHeight: 72,
  },
  rowPressed: {
    opacity: 0.5,
  },
  rowIndex: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 22,
    color: tokens.color.ink.tertiary,
    minWidth: 24,
    paddingTop: 2,
    fontVariant: ["tabular-nums"],
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowAddress: {
    fontFamily: tokens.font.serif,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "400",
    color: tokens.color.ink.primary,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
  },
  statusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: tokens.color.ink.secondary,
  },
  rowDate: {
    fontFamily: tokens.font.mono,
    fontSize: 11,
    fontWeight: "400",
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  rowArrow: {
    fontFamily: tokens.font.mono,
    fontSize: 16,
    fontWeight: "300",
    lineHeight: 24,
    color: tokens.color.ink.tertiary,
    paddingTop: 2,
  },

  // --- Center / empty / error ---
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.space[3],
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.space[6],
  },
  emptyBody: {
    fontFamily: tokens.font.serif,
    fontSize: 17,
    lineHeight: 26,
    color: tokens.color.ink.secondary,
    textAlign: "center",
  },
  errorText: {
    fontFamily: tokens.font.body,
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.semantic.block,
    textAlign: "center",
  },
  retry: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: tokens.color.accent.bright,
    textTransform: "uppercase",
  },

  // --- Footer ---
  footer: {
    paddingBottom: tokens.space[6],
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space[2],
    paddingVertical: tokens.space[4],
  },
  footerButtonPressed: {
    opacity: 0.5,
  },
  footerPlus: {
    fontFamily: tokens.font.mono,
    fontSize: 18,
    fontWeight: "300",
    color: tokens.color.ink.primary,
  },
  footerLabel: {
    fontFamily: tokens.font.mono,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: tokens.color.ink.primary,
    textTransform: "uppercase",
  },
});
