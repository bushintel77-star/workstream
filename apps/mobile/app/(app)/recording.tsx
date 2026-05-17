import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useWalkthroughApi } from "../../src/lib/api";

const MAX_DURATION_S = 30 * 60;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordingScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const api = useWalkthroughApi();

  const [permission, setPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Audio.requestPermissionsAsync().then(({ granted }) => {
      setPermission(granted);
    });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= MAX_DURATION_S) {
          return MAX_DURATION_S;
        }
        return e + 1;
      });
    }, 1000);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (!permission || !projectId) return;
    try {
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      startTimer();
    } catch (e) {
      Alert.alert("Recording failed", e instanceof Error ? e.message : "Unknown error");
    }
  }, [permission, projectId, startTimer]);

  const pauseRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || !isRecording) return;
    if (isPaused) {
      await rec.startAsync();
      setIsPaused(false);
      startTimer();
    } else {
      await rec.pauseAsync();
      setIsPaused(true);
      stopTimer();
    }
  }, [isRecording, isPaused, startTimer, stopTimer]);

  const finishAndUpload = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || !projectId) return;

    stopTimer();
    setUploading(true);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) {
        throw new Error("No recording file");
      }
      const durationS = Math.max(1, elapsed);

      await api.uploadRecording(projectId, uri, durationS);
      recordingRef.current = null;
      setIsRecording(false);
      router.replace(`/(app)/project/${projectId}`);
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload recording"
      );
    } finally {
      setUploading(false);
    }
  }, [api, elapsed, projectId, router, stopTimer]);

  const confirmCancel = useCallback(() => {
    Alert.alert("Discard recording?", "Your walkthrough will not be saved.", [
      { text: "Keep recording", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          stopTimer();
          const rec = recordingRef.current;
          if (rec) {
            try {
              await rec.stopAndUnloadAsync();
            } catch {
              /* ignore */
            }
          }
          recordingRef.current = null;
          router.back();
        },
      },
    ]);
  }, [router, stopTimer]);

  useEffect(() => {
    if (elapsed >= MAX_DURATION_S && isRecording) {
      finishAndUpload();
    }
  }, [elapsed, finishAndUpload, isRecording]);

  if (!projectId) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Missing project</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.pauseLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (permission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Microphone permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={confirmCancel} disabled={uploading}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.timerArea}>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
        <Text style={styles.status}>
          {uploading
            ? "Uploading…"
            : isRecording
              ? isPaused
                ? "Paused"
                : "Recording"
              : "Tap to record"}
        </Text>
      </View>

      <View style={styles.controls}>
        {isRecording && (
          <Pressable
            style={styles.pauseButton}
            onPress={pauseRecording}
            disabled={uploading}
          >
            <Text style={styles.pauseLabel}>{isPaused ? "Resume" : "Pause"}</Text>
          </Pressable>
        )}

        {uploading ? (
          <ActivityIndicator size="large" color="#C2410C" />
        ) : (
          <Pressable
            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
            onPress={
              isRecording ? finishAndUpload : startRecording
            }
            disabled={permission !== true}
          >
            <View
              style={[
                styles.recordInner,
                isRecording && styles.recordInnerStop,
              ]}
            />
          </Pressable>
        )}

        {isRecording && (
          <Text style={styles.hint}>Tap to stop & upload</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#18181B",
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: 20,
    alignItems: "flex-start",
  },
  cancel: {
    fontSize: 15,
    color: "#A1A1AA",
  },
  timerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  elapsed: {
    fontSize: 32,
    fontWeight: "600",
    color: "#FAFAF7",
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
  },
  status: {
    fontSize: 12,
    color: "#A1A1AA",
    marginTop: 8,
  },
  controls: {
    paddingBottom: 64,
    alignItems: "center",
    gap: 16,
  },
  pauseButton: {
    marginBottom: 8,
  },
  pauseLabel: {
    fontSize: 14,
    color: "#A1A1AA",
    fontWeight: "500",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#C2410C",
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: "#FAFAF7",
  },
  recordInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FAFAF7",
  },
  recordInnerStop: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#C2410C",
  },
  hint: {
    fontSize: 12,
    color: "#52525B",
    marginTop: 8,
  },
});
