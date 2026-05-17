import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Project, Recording } from "@walkthrough/contracts";
import { useWalkthroughApi } from "../../../src/lib/api";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWalkthroughApi();
  const [project, setProject] = useState<Project | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, recs] = await Promise.all([
        api.getProject(id),
        api.listRecordings(id),
      ]);
      setProject(p);
      setRecordings(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setLoading(false);
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      ) : error || !project ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? "Not found"}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.address}>{project.address}</Text>
          <Text style={styles.meta}>Status: {project.status}</Text>
          <Text style={styles.meta}>
            Created: {new Date(project.created_at).toLocaleDateString("en-AU")}
          </Text>

          {latest?.transcript ? (
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptLabel}>Transcript</Text>
              <Text style={styles.transcript}>{latest.transcript}</Text>
              {latest.transcription_confidence != null && (
                <Text style={styles.confidence}>
                  Confidence:{" "}
                  {Math.round(latest.transcription_confidence * 100)}%
                </Text>
              )}
            </View>
          ) : latest && !latest.transcript ? (
            <View style={styles.transcriptCard}>
              <ActivityIndicator color="#C2410C" />
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
              {latest ? "Record again" : "Start recording"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF7",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  address: {
    fontSize: 24,
    fontWeight: "600",
    color: "#18181B",
    marginBottom: 12,
  },
  meta: {
    fontSize: 15,
    color: "#52525B",
    marginBottom: 6,
  },
  transcriptCard: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#52525B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  transcript: {
    fontSize: 15,
    lineHeight: 22,
    color: "#18181B",
  },
  confidence: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 12,
    fontVariant: ["tabular-nums"],
  },
  processing: {
    fontSize: 14,
    color: "#52525B",
    marginTop: 12,
  },
  recordButton: {
    marginTop: 32,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#C2410C",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  error: {
    fontSize: 15,
    color: "#B91C1C",
    marginBottom: 12,
    textAlign: "center",
  },
  link: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C2410C",
  },
});
