import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { PlantPalette } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  "boundary tree": "BOUNDARY · PLEACHED",
  hedge: "HEDGE",
  feature: "FEATURE",
  shrub: "STRUCTURAL",
  mass: "MASS BLOCK",
  grass: "GRASS",
  ground: "GROUNDCOVER",
  climber: "CLIMBER",
  lawn: "LAWN",
};

function categoryFor(item: PlantPalette): string {
  const key = item.category.toLowerCase();
  for (const k of Object.keys(CATEGORY_LABEL)) {
    if (key.includes(k)) return CATEGORY_LABEL[k];
  }
  return item.category.toUpperCase();
}

export default function PlantPaletteScreen() {
  const api = useWorkstreamApi();
  const [items, setItems] = useState<PlantPalette[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const list = await api.listPlantPalette();
          if (!cancelled) setItems(list);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Text style={styles.count}>
        {loading ? "…" : `${items.length} species · Curtis & Co approved`}
      </Text>
      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          color={tokens.color.accent.default}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.common}>{item.common_name}</Text>
                <Text style={styles.size}>
                  {item.mature_h_m} × {item.mature_w_m} m
                </Text>
              </View>
              <Text style={styles.species}>{item.species}</Text>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{categoryFor(item)}</Text>
                </View>
                {item.form && (
                  <View style={[styles.tag, styles.tagSoft]}>
                    <Text style={styles.tagText}>
                      {item.form.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {item.use_description && (
                <Text style={styles.use}>{item.use_description}</Text>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  count: {
    paddingHorizontal: tokens.space[5],
    paddingVertical: tokens.space[3],
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    color: tokens.color.ink.secondary,
  },
  loader: {
    marginTop: tokens.space[7],
  },
  list: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[5],
    gap: tokens.space[2],
  },
  row: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    padding: tokens.space[4],
    gap: tokens.space[2],
  },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  common: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  species: {
    fontSize: tokens.type.caption.fontSize,
    fontStyle: "italic",
    color: tokens.color.ink.secondary,
  },
  size: {
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: tokens.type.bodyMono.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
    marginTop: tokens.space[1],
  },
  tag: {
    paddingHorizontal: tokens.space[2],
    paddingVertical: 2,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.surface.sunken,
  },
  tagSoft: {
    backgroundColor: tokens.color.accent.soft,
  },
  tagText: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  use: {
    marginTop: tokens.space[1],
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
});
