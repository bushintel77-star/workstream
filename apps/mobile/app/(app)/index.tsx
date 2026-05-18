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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import type { Project, ProjectStatus } from "@walkthrough/contracts";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../src/lib/api";

const STATUS_TONE: Record<
  ProjectStatus,
  { label: string; tone: "neutral" | "accent" | "ok" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  recording: { label: "Recording", tone: "accent" },
  processing: { label: "Processing", tone: "accent" },
  survey_review: { label: "Survey review", tone: "accent" },
  design_review: { label: "Design review", tone: "accent" },
  cost_review: { label: "Cost review", tone: "accent" },
  audit: { label: "Audit", tone: "accent" },
  outputs: { label: "Outputs", tone: "ok" },
  complete: { label: "Complete", tone: "ok" },
};

function statusStyle(tone: "neutral" | "accent" | "ok") {
  if (tone === "ok") {
    return {
      bg: "rgba(21,128,61,0.12)",
      fg: tokens.color.semantic.ok,
    };
  }
  if (tone === "accent") {
    return {
      bg: tokens.color.accent.soft,
      fg: tokens.color.accent.ink,
    };
  }
  return {
    bg: tokens.color.surface.sunken,
    fg: tokens.color.ink.secondary,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const api = useWalkthroughApi();
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
      Alert.alert(
        "Delete project?",
        `${project.address}\n\nAll recordings, survey, design, costing, audit and outputs for this project will be removed. Cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Walkthrough</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>
            {loading ? "—" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}${projects.length > 0 ? "  ·  long-press to delete" : ""}`}
          </Text>
          <Pressable onPress={() => router.push("/(app)/settings")}>
            <Text style={styles.settingsLink}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tokens.color.accent.default} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyKicker}>NEW STUDIO</Text>
          <Text style={styles.emptyText}>
            Start a project by entering an address. The walkthrough is the
            brief.
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = STATUS_TONE[item.status];
            const palette = statusStyle(meta.tone);
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed && { backgroundColor: tokens.color.surface.sunken },
                ]}
                onPress={() => router.push(`/(app)/project/${item.id}`)}
                onLongPress={() => confirmDelete(item)}
                delayLongPress={350}
              >
                <Text style={styles.cardAddress} numberOfLines={2}>
                  {item.address}
                </Text>
                <View style={styles.cardMetaRow}>
                  <View
                    style={[styles.statusPill, { backgroundColor: palette.bg }]}
                  >
                    <Text style={[styles.statusPillText, { color: palette.fg }]}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {new Date(item.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push("/(app)/new-project")}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  header: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[2],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: tokens.space[1],
  },
  title: {
    fontSize: tokens.type.displayL.fontSize,
    fontWeight: tokens.type.displayL.fontWeight,
    color: tokens.color.ink.primary,
    letterSpacing: tokens.type.displayL.letterSpacing,
  },
  subtitle: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    color: tokens.color.ink.secondary,
  },
  settingsLink: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: "600",
    color: tokens.color.accent.default,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: tokens.space[5],
    gap: tokens.space[3],
  },
  emptyKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  emptyText: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
    textAlign: "center",
    maxWidth: 280,
  },
  errorText: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.semantic.block,
    textAlign: "center",
  },
  retry: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.accent.default,
  },
  list: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: 96,
    gap: tokens.space[2],
  },
  card: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    padding: tokens.space[4],
    gap: tokens.space[2],
  },
  cardAddress: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
  },
  statusPillText: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  cardDate: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  fab: {
    position: "absolute",
    bottom: tokens.space[6],
    right: tokens.space[5],
    width: 56,
    height: 56,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
    ...tokens.elevation[2],
  },
  fabIcon: {
    fontSize: 28,
    color: tokens.color.ink.inverted,
    lineHeight: 30,
  },
});
