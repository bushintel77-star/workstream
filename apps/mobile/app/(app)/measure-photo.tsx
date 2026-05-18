import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@construct/ui";
import type {
  PhotoMeasurement,
  PhotoMeasurementItem,
  PhotoMeasurementUnit,
} from "@construct/contracts";
import { useConstructApi } from "../../src/lib/api";

const UNIT_LABEL: Record<PhotoMeasurementUnit, string> = {
  meters: "m",
  centimeters: "cm",
  millimeters: "mm",
  square_meters: "m²",
  cubic_meters: "m³",
  unknown: "?",
};

function pickedMime(asset: ImagePicker.ImagePickerAsset):
  | "image/jpeg"
  | "image/png"
  | "image/webp" {
  const t = asset.mimeType?.toLowerCase() ?? "";
  if (t.includes("png")) return "image/png";
  if (t.includes("webp")) return "image/webp";
  if (asset.uri.toLowerCase().endsWith(".png")) return "image/png";
  if (asset.uri.toLowerCase().endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export default function MeasurePhotoScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const api = useConstructApi();

  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [hint, setHint] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<PhotoMeasurement[]>([]);
  const [latest, setLatest] = useState<PhotoMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listMeasurements(projectId);
        if (!cancelled) setHistory(list);
      } catch {
        /* ignore — empty list is fine */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, projectId]);

  const pickFromGallery = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photos access denied",
        "Enable photo library access in Settings to pick an image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPicked(result.assets[0]);
      setLatest(null);
      setError(null);
    }
  }, []);

  const captureFromCamera = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access denied",
        "Enable camera access in Settings to capture an image.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPicked(result.assets[0]);
      setLatest(null);
      setError(null);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!projectId || !picked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRunning(true);
    setError(null);
    try {
      const measurement = await api.measurePhoto(
        projectId,
        picked.uri,
        pickedMime(picked),
        hint.trim() || undefined,
      );
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setLatest(measurement);
      setHistory((prev) => [measurement, ...prev]);
      setPicked(null);
      setHint("");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setError(e instanceof Error ? e.message : "Measurement failed");
    } finally {
      setRunning(false);
    }
  }, [api, hint, picked, projectId]);

  if (!projectId) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Missing project</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>MEASURE FROM PHOTO</Text>
          <Text style={styles.heading}>
            Snap a site photo. Claude Vision pulls dimensions.
          </Text>
          <Text style={styles.helper}>
            Include a reference object in frame for best results — a known
            paver, brick course (230mm), or door frame (820–870mm) — and
            describe it in the hint below.
          </Text>

          <View style={styles.pickerRow}>
            <Pressable
              onPress={captureFromCamera}
              style={styles.pickerBtn}
              accessibilityRole="button"
              accessibilityLabel="Take photo with camera"
            >
              <Text style={styles.pickerBtnText}>CAMERA</Text>
            </Pressable>
            <Pressable
              onPress={pickFromGallery}
              style={[styles.pickerBtn, styles.pickerBtnGhost]}
              accessibilityRole="button"
              accessibilityLabel="Pick from gallery"
            >
              <Text style={[styles.pickerBtnText, styles.pickerBtnTextGhost]}>
                GALLERY
              </Text>
            </Pressable>
          </View>

          {picked && (
            <View style={styles.preview}>
              <Image
                source={{ uri: picked.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>REFERENCE / HINT (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={hint}
              onChangeText={setHint}
              placeholder="The paver in the foreground is 600mm wide"
              placeholderTextColor={tokens.color.ink.tertiary}
              multiline
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={!picked || running}
            style={[
              styles.submitBtn,
              (!picked || running) && styles.submitBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Extract measurements"
            accessibilityState={{ disabled: !picked || running, busy: running }}
          >
            {running ? (
              <ActivityIndicator color={tokens.color.ink.inverted} />
            ) : (
              <Text style={styles.submitBtnText}>Extract measurements →</Text>
            )}
          </Pressable>

          {latest && (
            <View style={styles.resultCard}>
              <Text style={styles.cardLabel}>EXTRACTED · {latest.items.length}</Text>
              {latest.items.map((it, i) => (
                <MeasurementRow key={i} item={it} />
              ))}
              {latest.notes && (
                <Text style={styles.notes}>{latest.notes}</Text>
              )}
            </View>
          )}

          {history.length > 0 && (
            <View style={styles.historyBlock}>
              <Text style={styles.cardLabel}>HISTORY · {history.length}</Text>
              {history.slice(0, 8).map((m) => (
                <View key={m.id} style={styles.historyRow}>
                  <Image
                    source={{ uri: m.image_uri }}
                    style={styles.historyThumb}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyMeta}>
                      {new Date(m.created_at).toLocaleString("en-AU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                    <Text style={styles.historyCount}>
                      {m.items.length} item{m.items.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MeasurementRow({ item }: { item: PhotoMeasurementItem }) {
  const pct = Math.round(item.confidence * 100);
  const tone =
    item.confidence >= 0.85
      ? tokens.color.semantic.ok
      : item.confidence >= 0.6
        ? tokens.color.semantic.warn
        : tokens.color.semantic.block;

  return (
    <View style={styles.measurementRow}>
      <View style={styles.measurementHead}>
        <Text style={styles.measurementDescription}>{item.description}</Text>
        <Text style={styles.measurementValue}>
          {item.value} {UNIT_LABEL[item.unit]}
        </Text>
      </View>
      <View style={styles.confidenceBar}>
        <View
          style={[
            styles.confidenceFill,
            { width: `${pct}%`, backgroundColor: tone },
          ]}
        />
      </View>
      <View style={styles.measurementMetaRow}>
        <Text style={styles.measurementMeta}>{pct}% confidence</Text>
        {item.reference_used && (
          <Text style={styles.measurementRef}>
            via {item.reference_used}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  content: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[5],
    paddingBottom: tokens.space[7],
    gap: tokens.space[3],
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
    color: tokens.color.ink.primary,
  },
  helper: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
    marginBottom: tokens.space[3],
  },
  pickerRow: {
    flexDirection: "row",
    gap: tokens.space[3],
  },
  pickerBtn: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface.inverted,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
  },
  pickerBtnText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  pickerBtnTextGhost: {
    color: tokens.color.ink.secondary,
  },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    backgroundColor: tokens.color.surface.sunken,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  field: {
    gap: tokens.space[2],
  },
  fieldLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  fieldInput: {
    minHeight: 56,
    backgroundColor: tokens.color.surface.sunken,
    padding: tokens.space[3],
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
    borderBottomWidth: 2,
    borderBottomColor: tokens.color.ink.primary,
    textAlignVertical: "top",
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  submitBtn: {
    height: 52,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
    marginTop: tokens.space[2],
  },
  submitBtnDisabled: {
    backgroundColor: tokens.color.line.strong,
  },
  submitBtnText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
  },
  resultCard: {
    marginTop: tokens.space[4],
    padding: tokens.space[4],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    gap: tokens.space[3],
  },
  cardLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  notes: {
    fontSize: tokens.type.caption.fontSize,
    fontStyle: "italic",
    color: tokens.color.ink.tertiary,
    lineHeight: tokens.type.caption.lineHeight,
  },
  measurementRow: {
    gap: tokens.space[1],
    paddingTop: tokens.space[2],
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
  },
  measurementHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  measurementDescription: {
    flex: 1,
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  measurementValue: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  confidenceBar: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tokens.color.surface.sunken,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
  },
  measurementMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  measurementMeta: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  measurementRef: {
    fontSize: tokens.type.micro.fontSize,
    color: tokens.color.ink.tertiary,
    fontStyle: "italic",
  },
  historyBlock: {
    marginTop: tokens.space[4],
    gap: tokens.space[2],
  },
  historyRow: {
    flexDirection: "row",
    gap: tokens.space[3],
    alignItems: "center",
    padding: tokens.space[2],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
  },
  historyThumb: {
    width: 56,
    height: 42,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.surface.sunken,
  },
  historyMeta: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  historyCount: {
    fontSize: tokens.type.micro.fontSize,
    color: tokens.color.ink.tertiary,
  },
  errorText: {
    color: tokens.color.semantic.block,
    fontSize: tokens.type.body.fontSize,
    textAlign: "center",
    marginTop: tokens.space[7],
  },
  link: {
    color: tokens.color.accent.default,
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    textAlign: "center",
    marginTop: tokens.space[3],
  },
});
