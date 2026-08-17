import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { useWorkstreamApi } from "../../../src/lib/api";

export default function FilingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWorkstreamApi();
  const [items, setItems] = useState<
    Array<{ id: string; title: string; uri: string }>
  >([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const gallery = await api.getProjectGallery(id);
      setItems(
        gallery.viewable.map((i) => ({
          id: i.id,
          title: i.title,
          uri: i.uri,
        })),
      );
    } catch (e) {
      void import("../../../src/lib/sentry").then(({ captureMobileError }) =>
        captureMobileError(e, { boundary: "mobile-filing-load", id }),
      );
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const width = Dimensions.get("window").width;
  const item = items[index];

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Plans & pics</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Nothing filed yet — upload from web Filing tab.</Text>
      ) : (
        <>
          <View style={[styles.stage, { width: width - 32 }]}>
            <Image
              source={{ uri: item!.uri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.caption}>{item!.title}</Text>
          <View style={styles.nav}>
            <Pressable
              onPress={() => setIndex((i) => (i - 1 + items.length) % items.length)}
              style={styles.navBtn}
            >
              <Text style={styles.navBtnText}>‹ Prev</Text>
            </Pressable>
            <Text style={styles.counter}>
              {index + 1} / {items.length}
            </Text>
            <Pressable
              onPress={() => setIndex((i) => (i + 1) % items.length)}
              style={styles.navBtn}
            >
              <Text style={styles.navBtnText}>Next ›</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
    paddingHorizontal: tokens.space[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    marginBottom: tokens.space[3],
  },
  back: {
    fontSize: 16,
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.color.ink.primary,
  },
  stage: {
    aspectRatio: 5 / 3,
    backgroundColor: tokens.color.surface.sunken,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    alignSelf: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  caption: {
    marginTop: tokens.space[3],
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: tokens.space[4],
  },
  navBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: tokens.space[3],
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  counter: {
    fontSize: 13,
    color: tokens.color.ink.tertiary,
  },
  empty: {
    marginTop: tokens.space[6],
    textAlign: "center",
    color: tokens.color.ink.secondary,
    paddingHorizontal: tokens.space[4],
  },
});
