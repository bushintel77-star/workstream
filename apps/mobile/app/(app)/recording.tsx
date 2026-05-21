import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../src/lib/api";

const MAX_DURATION_S = 30 * 60;
const METERING_WINDOW = 56;
const METERING_INTERVAL_MS = 60;
const LIVE_DOT_PULSE_MS = 900;

const VAD_WINDOW = 10;
const VAD_VOICE_MEAN = 0.34;
const VAD_SILENT_MEAN = 0.16;
const AMBIENT_WINDOW = 30;
const AMBIENT_MEDIAN_THRESHOLD = 0.55;
const CLIP_THRESHOLD = 0.92;
const CLIP_DECAY_MS = 600;

type VadState = "silent" | "voice" | "ambient";

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

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export default function RecordingScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const api = useWorkstreamApi();

  const [permission, setPermission] = useState<boolean | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activating, setActivating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(METERING_WINDOW).fill(0),
  );
  const [vad, setVad] = useState<VadState>("silent");
  const [clipping, setClipping] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelsRef = useRef<number[]>(new Array(METERING_WINDOW).fill(0));
  const vadSamplesRef = useRef<number[]>([]);
  const ambientSamplesRef = useRef<number[]>([]);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dotOpacity = useRef(new Animated.Value(1)).current;
  const levelAnim = useRef(new Animated.Value(0)).current;
  const armedScale = useRef(new Animated.Value(1)).current;

  // ----- Permission + audio session setup ---------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await Audio.requestPermissionsAsync();
        if (!cancelled) {
          setPermission(result.granted);
          setPermissionAsked(true);
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        });
      } catch {
        if (!cancelled) {
          setPermission(false);
          setPermissionAsked(true);
        }
      }
    })();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      sub.remove();
    };
  }, []);

  // ----- Live LIVE-dot pulse ----------------------------------------------
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

  // ----- Timer -------------------------------------------------------------
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsed((e) => (e + 1 >= MAX_DURATION_S ? MAX_DURATION_S : e + 1));
    }, 1000);
  }, [stopTimer]);

  // ----- Metering callback drives waveform, VAD, halo, clip detection ----
  const onStatusUpdate = useCallback(
    (status: Audio.RecordingStatus) => {
      if (!status.isRecording) return;
      const level = levelFromDb(status.metering);

      const nextLevels = levelsRef.current.slice(1);
      nextLevels.push(level);
      levelsRef.current = nextLevels;
      setLevels(nextLevels);

      // Native-driven level → halo + button scale interpolations
      Animated.spring(levelAnim, {
        toValue: level,
        tension: 220,
        friction: 14,
        useNativeDriver: true,
      }).start();

      // VAD: rolling mean classifier
      const vadBuf = vadSamplesRef.current;
      vadBuf.push(level);
      if (vadBuf.length > VAD_WINDOW) vadBuf.shift();
      const vadMean = mean(vadBuf);

      // Ambient: longer-window median
      const ambBuf = ambientSamplesRef.current;
      ambBuf.push(level);
      if (ambBuf.length > AMBIENT_WINDOW) ambBuf.shift();
      const ambMedian =
        ambBuf.length === AMBIENT_WINDOW ? median(ambBuf) : 0;

      if (ambMedian > AMBIENT_MEDIAN_THRESHOLD) {
        setVad("ambient");
      } else if (vadMean > VAD_VOICE_MEAN) {
        setVad("voice");
      } else if (vadMean < VAD_SILENT_MEAN) {
        setVad("silent");
      }

      // Clip detection
      if (level >= CLIP_THRESHOLD) {
        setClipping(true);
        if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
        clipTimerRef.current = setTimeout(
          () => setClipping(false),
          CLIP_DECAY_MS,
        );
      }
    },
    [levelAnim],
  );

  // ----- Activation: optimistic UI then create recorder -------------------
  const startRecording = useCallback(async () => {
    if (!permission || !projectId || activating || isRecording) return;
    setActivating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(armedScale, {
      toValue: 0.94,
      useNativeDriver: true,
      tension: 220,
      friction: 12,
    }).start();

    try {
      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };
      levelsRef.current = new Array(METERING_WINDOW).fill(0);
      vadSamplesRef.current = [];
      ambientSamplesRef.current = [];
      setLevels(levelsRef.current);
      setVad("silent");
      setClipping(false);

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
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      Animated.spring(armedScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 10,
      }).start();
    } catch (e) {
      Animated.spring(armedScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      Alert.alert(
        "Recording failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setActivating(false);
    }
  }, [
    permission,
    projectId,
    activating,
    isRecording,
    armedScale,
    startTimer,
    onStatusUpdate,
  ]);

  const pauseRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec || !isRecording) return;
    Haptics.selectionAsync().catch(() => {});
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
      router.replace(`/(app)/processing/${projectId}`);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not upload recording",
      );
    } finally {
      setUploading(false);
    }
  }, [api, elapsed, projectId, router, stopTimer]);

  const confirmCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Alert.alert("Discard recording?", "Your walkthrough will not be saved.", [
      { text: "Keep recording", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          ).catch(() => {});
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

  // ----- Derived animation styles -----------------------------------------
  const haloOuterStyle = useMemo(
    () => ({
      transform: [
        {
          scale: levelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.85],
            extrapolate: "clamp" as const,
          }),
        },
      ],
      opacity: levelAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.06, 0.28],
        extrapolate: "clamp" as const,
      }),
    }),
    [levelAnim],
  );
  const haloInnerStyle = useMemo(
    () => ({
      transform: [
        {
          scale: levelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.45],
            extrapolate: "clamp" as const,
          }),
        },
      ],
      opacity: levelAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.12, 0.45],
        extrapolate: "clamp" as const,
      }),
    }),
    [levelAnim],
  );
  const buttonScaleStyle = useMemo(
    () => ({
      transform: [
        { scale: armedScale },
        {
          scale: levelAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.06],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    }),
    [levelAnim, armedScale],
  );

  // ----- Render -----------------------------------------------------------
  if (!projectId) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusLabel}>Missing project</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.permActionGhost}
        >
          <Text style={styles.permActionGhostText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (permissionAsked && permission === false) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permKicker}>WALKTHROUGH</Text>
        <Text style={styles.permHeading}>Microphone access needed</Text>
        <Text style={styles.permBody}>
          Workstream captures your voice notes on site so the AI can turn the
          brief into a design and costing. Enable microphone access in Settings
          to continue.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open device settings"
          style={styles.permActionPrimary}
        >
          <Text style={styles.permActionPrimaryText}>Open Settings</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.permActionGhost}
        >
          <Text style={styles.permActionGhostText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const liveStatus = !isRecording
    ? activating
      ? "Arming"
      : "Ready"
    : isPaused
      ? "Paused"
      : vad === "ambient"
        ? "Listening · ambient noise high"
        : vad === "voice"
          ? "Voice detected"
          : "Listening · quiet";

  const transcriptHint = !isRecording
    ? "Single tap to start. Audio stays captured while screen is locked."
    : isPaused
      ? "Paused. Tap RESUME to continue."
      : "Speak naturally. Live transcript is finalised on stop.";

  return (
    <View style={styles.container}>
      <View style={styles.topStrip}>
        <View style={styles.liveRow}>
          <Animated.View
            style={[
              styles.liveDot,
              {
                opacity: isRecording && !isPaused ? dotOpacity : 0.25,
                backgroundColor:
                  vad === "ambient"
                    ? tokens.color.semantic.warn
                    : tokens.color.accent.default,
              },
            ]}
          />
          <Text
            style={styles.liveLabel}
            accessibilityLiveRegion="polite"
          >
            {liveStatus.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.transcriptStrip} numberOfLines={1}>
          {transcriptHint}
        </Text>
      </View>

      <View style={styles.timerArea}>
        <Text style={styles.elapsed} accessibilityLabel={`Elapsed time ${formatElapsed(elapsed)}`}>
          {formatElapsed(elapsed)}
        </Text>
        <View style={styles.waveformRow}>
          {levels.map((lv, i) => {
            const h = 4 + Math.round(lv * 38);
            const isHead = i >= levels.length - 8;
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
                    opacity: isRecording ? 1 : 0.3,
                  },
                ]}
              />
            );
          })}
        </View>
        {clipping && (
          <Text style={styles.clipLabel} accessibilityLiveRegion="polite">
            CLIPPING · STEP BACK FROM SOURCE
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        {isRecording ? (
          <Pressable
            onPress={pauseRecording}
            disabled={uploading}
            hitSlop={16}
            style={styles.pauseHit}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? "Resume recording" : "Pause recording"}
          >
            <Text style={styles.pauseLabel}>
              {isPaused ? "RESUME" : "PAUSE"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={confirmCancel}
            hitSlop={16}
            style={styles.pauseHit}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back"
          >
            <Text style={styles.pauseLabel}>CANCEL</Text>
          </Pressable>
        )}

        <View style={styles.recordButtonStack}>
          {!reduceMotion && (
            <>
              <Animated.View
                style={[
                  styles.recordButtonHaloOuter,
                  haloOuterStyle,
                  clipping && styles.haloClip,
                ]}
                pointerEvents="none"
              />
              <Animated.View
                style={[
                  styles.recordButtonHaloInner,
                  haloInnerStyle,
                  clipping && styles.haloClip,
                ]}
                pointerEvents="none"
              />
            </>
          )}

          {uploading ? (
            <View style={styles.recordButton}>
              <ActivityIndicator
                size="large"
                color={tokens.color.ink.inverted}
              />
            </View>
          ) : (
            <Animated.View style={buttonScaleStyle}>
              <Pressable
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive,
                  activating && styles.recordButtonArming,
                ]}
                onPress={isRecording ? finishAndUpload : startRecording}
                disabled={
                  permission !== true || activating || uploading
                }
                accessibilityRole="button"
                accessibilityState={{
                  busy: activating || uploading,
                  selected: isRecording,
                }}
                accessibilityLabel={
                  isRecording ? "Stop and upload" : "Start recording"
                }
                accessibilityHint={
                  isRecording
                    ? "Stops capture and uploads the walkthrough"
                    : "Begins voice capture for this project"
                }
              >
                <View
                  style={[
                    styles.recordInner,
                    isRecording && styles.recordInnerStop,
                  ]}
                />
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Text style={styles.hint}>
          {uploading
            ? "Uploading…"
            : isRecording
              ? "Tap to stop & upload"
              : activating
                ? "Arming microphone…"
                : "Tap to start"}
        </Text>
      </View>
    </View>
  );
}

const HALO_OUTER_SIZE = 260;
const HALO_INNER_SIZE = 196;
const RECORD_BUTTON_SIZE = 132;

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
  clipLabel: {
    color: tokens.color.semantic.block,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  controls: {
    alignItems: "center",
    gap: tokens.space[4],
  },
  pauseHit: {
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.space[4],
    minHeight: 44,
    justifyContent: "center",
  },
  pauseLabel: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  recordButtonStack: {
    width: HALO_OUTER_SIZE,
    height: HALO_OUTER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  recordButtonHaloOuter: {
    position: "absolute",
    width: HALO_OUTER_SIZE,
    height: HALO_OUTER_SIZE,
    borderRadius: HALO_OUTER_SIZE / 2,
    backgroundColor: tokens.color.accent.default,
  },
  recordButtonHaloInner: {
    position: "absolute",
    width: HALO_INNER_SIZE,
    height: HALO_INNER_SIZE,
    borderRadius: HALO_INNER_SIZE / 2,
    backgroundColor: tokens.color.accent.default,
  },
  haloClip: {
    backgroundColor: tokens.color.semantic.block,
  },
  recordButton: {
    width: RECORD_BUTTON_SIZE,
    height: RECORD_BUTTON_SIZE,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: tokens.color.ink.inverted,
  },
  recordButtonArming: {
    opacity: 0.85,
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
  statusLabel: {
    color: tokens.color.ink.tertiary,
    textAlign: "center",
    marginTop: tokens.space[7],
  },
  permContainer: {
    flex: 1,
    backgroundColor: tokens.color.surface.inverted,
    paddingTop: 96,
    paddingHorizontal: tokens.space[5],
    gap: tokens.space[3],
  },
  permKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  permHeading: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.inverted,
  },
  permBody: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.tertiary,
    marginTop: tokens.space[2],
    marginBottom: tokens.space[5],
  },
  permActionPrimary: {
    height: 52,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  permActionPrimaryText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
  },
  permActionGhost: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  permActionGhostText: {
    color: tokens.color.ink.tertiary,
    fontSize: tokens.type.body.fontSize,
  },
});
