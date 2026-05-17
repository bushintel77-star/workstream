import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import type { Project } from "@walkthrough/contracts";
import { useWalkthroughApi } from "../../src/lib/api";

function statusLabel(status: Project["status"]): string {
  return status.replace(/_/g, " ");
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
    }, [load])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Walkthrough</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Projects</Text>
          <Pressable onPress={() => router.push("/(app)/settings")}>
            <Text style={styles.settingsLink}>Settings</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C2410C" />
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
          <Text style={styles.emptyText}>No projects yet</Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(app)/project/${item.id}`)}
            >
              <Text style={styles.cardAddress} numberOfLines={2}>
                {item.address}
              </Text>
              <Text style={styles.cardMeta}>{statusLabel(item.status)}</Text>
            </Pressable>
          )}
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
    backgroundColor: "#FAFAF7",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#18181B",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#52525B",
  },
  settingsLink: {
    fontSize: 15,
    fontWeight: "500",
    color: "#C2410C",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: "#A1A1AA",
  },
  errorText: {
    fontSize: 15,
    color: "#B91C1C",
    textAlign: "center",
    marginBottom: 12,
  },
  retry: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C2410C",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    padding: 16,
  },
  cardAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#18181B",
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 13,
    color: "#52525B",
    textTransform: "capitalize",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#C2410C",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 28,
    color: "#FFFFFF",
    lineHeight: 30,
  },
});
