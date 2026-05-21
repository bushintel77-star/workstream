import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../src/lib/api";

export default function ConfirmPinScreen() {
  const router = useRouter();
  const api = useWorkstreamApi();
  const { address, lat, lng } = useLocalSearchParams<{
    address: string;
    lat: string;
    lng: string;
  }>();

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk = Number.isFinite(latN) && Number.isFinite(lngN);

  const [aerialUri, setAerialUri] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coordsOk) {
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      try {
        const preview = await api.geocodePreview(latN, lngN);
        if (!cancelled) setAerialUri(preview.aerial_uri);
      } catch {
        if (!cancelled) setAerialUri(null);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, coordsOk, latN, lngN]);

  async function createAndRecord() {
    if (!address?.trim() || !coordsOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await api.createProject({
        address: address.trim(),
        lat: latN,
        lng: lngN,
      });
      router.replace(`/(app)/recording?projectId=${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  async function createOnly() {
    if (!address?.trim() || !coordsOk) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await api.createProject({
        address: address.trim(),
        lat: latN,
        lng: lngN,
      });
      router.replace(`/(app)/project/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  if (!address || !coordsOk) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.error}>Missing address or coordinates.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>CONFIRM SITE</Text>
        <Text style={styles.heading}>Does the pin look right?</Text>
        <Text style={styles.address}>{address}</Text>
        <Text style={styles.coords}>
          {latN.toFixed(5)}, {lngN.toFixed(5)}
        </Text>

        <View style={styles.aerialFrame}>
          {loadingPreview ? (
            <ActivityIndicator color={tokens.color.accent.default} />
          ) : aerialUri ? (
            <Image
              source={{ uri: aerialUri }}
              style={styles.aerial}
              resizeMode="cover"
              accessibilityLabel="Satellite preview of the site"
            />
          ) : (
            <Text style={styles.aerialFallback}>
              Aerial preview unavailable. You can still continue — survey will
              geocode the address.
            </Text>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, submitting && styles.btnBusy]}
          onPress={createAndRecord}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Confirm pin and start recording"
        >
          {submitting ? (
            <ActivityIndicator color={tokens.color.ink.inverted} />
          ) : (
            <Text style={styles.primaryBtnText}>Looks right — record →</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={createOnly}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Confirm pin without recording"
        >
          <Text style={styles.secondaryBtnText}>Confirm, record later</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Adjust address"
        >
          <Text style={styles.ghost}>Adjust address</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
    gap: tokens.space[3],
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.space[5],
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
    color: tokens.color.ink.primary,
  },
  address: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  coords: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  aerialFrame: {
    marginTop: tokens.space[2],
    aspectRatio: 5 / 3,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    backgroundColor: tokens.color.surface.sunken,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    justifyContent: "center",
    alignItems: "center",
  },
  aerial: {
    width: "100%",
    height: "100%",
  },
  aerialFallback: {
    padding: tokens.space[4],
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
    textAlign: "center",
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  link: {
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[4],
    gap: tokens.space[3],
  },
  primaryBtn: {
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  btnBusy: { opacity: 0.85 },
  primaryBtnText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  ghost: {
    textAlign: "center",
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    paddingVertical: tokens.space[2],
  },
});
