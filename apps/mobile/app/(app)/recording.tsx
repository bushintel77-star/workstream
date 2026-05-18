import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../src/lib/api";

const MAX_DURATION_S = 30 * 60;
const METERING_WINDOW = 48;
const METERING_INTERVAL_MS = 80;
const LIVE_DOT_PULSE_MS = 900;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function levelFromDb(db: number | undefined | null): number {
  if (db == null || !Number.isFinite(db)) return 0;
  const normalized = (db + 60) / 60;
  return Math.max(0, Math.min(1, normalized));
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
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(METERING_WINDOW).fill(0),
  );
  const [currentLevel, setCurrentLevel] = useState(0);
  const [ambientWarn, setAmbientWarn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelsRef = useRef<number[]>(new Array(METERING_WINDOW).fill(0));
  const ambientSamplesRef = useRef<number[]>([]);
  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Audio.requestPermissionsAsync().then(({ granted }) => {
      setPermission(granted);
    });
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isRecording || isPaused || reduceMotion) {
      dotOpacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 0.25,
          duration: LIVE_DOT_PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: LIVE_DOT_PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isRecording, isPaused, dotOpacity, reduceMotion]);

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
        if (e + 1 >= MAX_DURATION_S) return MAX_DURATION_S;
        return e + 1;
      });
    }, 1000);
  }, [stopTimer]);

  const onStatusUpdate = useCallback((status: Audio.RecordingStatus) => {
    if (!status.isRecording) return;
    const level = levelFromDb(status.metering);
    const next = levelsRef.current.slice(1);
    next.push(level);
    levelsRef.current = next;
    setLevels(next);
    setCurrentLevel(level);

    const samples = ambientSamplesRef.current;
    samples.push(level);
    if (samples.length > 24) samples.shift();
    if (samples.length === 24) {
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      setAmbientWarn(median > 0.55);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!permission || !projectId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };
      levelsRef.current = new Array(METERING_WINDOW).fill(0);
      ambientSamplesRef.current = [];
      setLevels(levelsRef.current);
      setAmbientWarn(false);

      const { recording: rec } = await Audio.Recording.createAsync(
        recordingOptions,
        onStatusUpdate,
        METERING_INTERVAL_MS,
      );
      recordingRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      startTimer();
    } catch (e) {
      Alert.alert(
        "Recording failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  }, [permission, projectId, startTimer, onStatusUpdate]);

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

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    stopTimer();
    setUploading(true);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) throw new Error("No recording file");
      const durationS = Math.max(1, elapsed);

      await api.uploadRecording(projectId, uri, durationS);
      recordingRef.current = null;
      setIsRecording(false);
      router.replace(`/(app)/project/${projectId}`);
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload recording",
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
        <Text style={styles.statusLabel}>Missing project</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (permission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusLabel}>Microphone permission required</Text>
      </View>
    );
  }

  const liveStatus = !isRecording
    ? "Ready"
    : isPaused
      ? "Paused"
      : ambientWarn
        ? "Listening · ambient noise high"
        : "Listening";

  return (
    <View style={styles.container}>
      <View style={styles.topStrip}>
        <View style={styles.liveRow}>
          <Animated.View
            style={[
              styles.liveDot,
              { opacity: isRecording && !isPaused ? dotOpacity : 0.25 },
            ]}
          />
          <Text style={styles.liveLabel}>{liveStatus.toUpperCase()}</Text>
        </View>
        <Text style={styles.transcriptStrip} numberOfLines={1}>
          {isRecording
            ? "Live transcript continues after upload"
            : "Live transcript appears here while you record"}
        </Text>
      </View>

      <View style={styles.timerArea}>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
        <View style={styles.waveformRow}>
          {levels.map((lv, i) => {
            const h = 4 + Math.round(lv * 36);
            const isHead = i >= levels.length - 6;
            return (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: h,
                    backgroundColor: isHead
                      ? tokens.color.accent.default
                      : tokens.color.ink.tertiary,
                    opacity: isRecording ? 1 : 0.35,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.controls}>
        {isRecording ? (
          <Pressable
            onPress={pauseRecording}
            disabled={uploading}
            hitSlop={16}
            style={styles.pauseHit}
          >
            <Text style={styles.pauseLabel}>
              {isPaused ? "RESUME" : "PAUSE"}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={confirmCancel} hitSlop={16} style={styles.pauseHit}>
            <Text style={styles.pauseLabel}>CANCEL</Text>
          </Pressable>
        )}

        {uploading ? (
          <View style={styles.recordButton}>
            <ActivityIndicator size="large" color={tokens.color.ink.inverted} />
          </View>
        ) : (
          <Pressable
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              {
                transform: [
                  { scale: isRecording ? 1 + currentLevel * 0.04 : 1 },
                ],
              },
            ]}
            onPress={isRecording ? finishAndUpload : startRecording}
            disabled={permission !== true}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Stop and upload" : "Start recording"
            }
          >
            <View
              style={[
                styles.recordInner,
                isRecording && styles.recordInnerStop,
              ]}
            />
          </Pressable>
        )}

        <Text style={styles.hint}>
          {uploading
            ? "Uploading…"
            : isRecording
              ? "Tap to stop & upload"
              : "Tap to start"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.inverted,
    paddingTop: 56,
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[7],
  },
  topStrip: {
    minHeight: 60,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
  },
  liveLabel: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  transcriptStrip: {
    marginTop: tokens.space[3],
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    fontVariant: ["tabular-nums"],
    opacity: 0.7,
  },
  timerArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: tokens.space[6],
  },
  elapsed: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  controls: {
    alignItems: "center",
    gap: tokens.space[4],
  },
  pauseHit: {
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.space[4],
  },
  pauseLabel: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  recordButton: {
    width: 132,
    height: 132,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: tokens.color.ink.inverted,
  },
  recordInner: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.ink.inverted,
  },
  recordInnerStop: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.accent.default,
  },
  hint: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
  },
  cancel: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.body.fontSize,
  },
  statusLabel: {
    color: tokens.color.ink.tertiary,
    textAlign: "center",
    marginTop: tokens.space[7],
  },
});
