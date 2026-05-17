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
import type { PlantPalette } from "@walkthrough/contracts";
import { useWalkthroughApi } from "../../../src/lib/api";

export default function PlantPaletteScreen() {
  const api = useWalkthroughApi();
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
    }, [api])
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Text style={styles.count}>
        {loading ? "…" : `${items.length} species`}
      </Text>
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#C2410C" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.common}>{item.common_name}</Text>
              <Text style={styles.species}>{item.species}</Text>
              <Text style={styles.size}>
                {item.mature_h_m} × {item.mature_w_m} m
              </Text>
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
    backgroundColor: "#FAFAF7",
  },
  count: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: "500",
    color: "#52525B",
  },
  loader: {
    marginTop: 48,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    padding: 12,
  },
  common: {
    fontSize: 15,
    fontWeight: "600",
    color: "#18181B",
    marginBottom: 4,
  },
  species: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#52525B",
    marginBottom: 6,
  },
  size: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#18181B",
  },
});
