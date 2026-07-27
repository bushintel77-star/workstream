import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../src/lib/api";

/**
 * First-create locate loader only — reopening a project never hits this route.
 */
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

  const started = useRef(false);
  const [phase, setPhase] = useState<
    "locating" | "measuring" | "ready" | "error"
  >("locating");
  const [aerialUri, setAerialUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status =
    phase === "locating"
      ? "Locating your property…"
      : phase === "measuring"
        ? "Measuring up the property…"
        : phase === "ready"
          ? "Opening site…"
          : "Could not open site";

  useEffect(() => {
    if (!coordsOk || !address?.trim() || started.current) return;
    started.current = true;
    let cancelled = false;

    void (async () => {
      const t0 = Date.now();
      try {
        const previewPromise = api
          .geocodePreview(latN, lngN)
          .catch(() => null);
        const createPromise = api.createProject({
          address: address.trim(),
          lat: latN,
          lng: lngN,
        });

        const preview = await previewPromise;
        if (cancelled) return;
        if (preview?.aerial_uri) setAerialUri(preview.aerial_uri);

        const locateWait = 900 - (Date.now() - t0);
        if (locateWait > 0) {
          await new Promise((r) => setTimeout(r, locateWait));
        }
        if (cancelled) return;
        setPhase("measuring");

        const measureStart = Date.now();
        const project = await createPromise;
        if (cancelled) return;

        const measureWait = 1400 - (Date.now() - measureStart);
        if (measureWait > 0) {
          await new Promise((r) => setTimeout(r, measureWait));
        }
        if (cancelled) return;

        setPhase("ready");
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;
        router.replace(`/(app)/project/${project.id}`);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to create project");
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, api, coordsOk, latN, lngN, router]);

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
      <View style={styles.content}>
        <Text style={styles.kicker}>NEW SITE</Text>
        <Text style={styles.heading}>{status}</Text>
        <Text style={styles.address}>{address}</Text>
        <Text style={styles.lede}>
          Vicmap title on aerial — the view you design from.
        </Text>

        <View style={styles.aerialFrame}>
          {aerialUri ? (
            <Image
              source={{ uri: aerialUri }}
              style={styles.aerial}
              resizeMode="cover"
              accessibilityLabel="Locating property aerial"
            />
          ) : (
            <ActivityIndicator color={tokens.color.accent.default} />
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {phase === "error" ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Go back</Text>
          </Pressable>
        ) : null}
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
    flex: 1,
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
    fontSize: tokens.type.title.fontSize,
    lineHeight: tokens.type.title.lineHeight,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  lede: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
  aerialFrame: {
    marginTop: tokens.space[2],
    aspectRatio: 5 / 3,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    backgroundColor: tokens.color.surface.sunken,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  aerial: {
    width: "100%",
    height: "100%",
  },
  error: {
    color: "#c4463b",
    fontSize: tokens.type.body.fontSize,
  },
  link: {
    color: tokens.color.ink.secondary,
    fontSize: tokens.type.body.fontSize,
    textAlign: "center",
    minHeight: 44,
    paddingTop: 12,
  },
});
