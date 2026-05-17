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
import type { RateCard } from "@walkthrough/contracts";
import { useWalkthroughApi } from "../../../src/lib/api";

export default function RateCardScreen() {
  const api = useWalkthroughApi();
  const [items, setItems] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const list = await api.listRateCard();
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
        {loading ? "…" : `${items.length} items`}
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
              <View style={styles.rowMain}>
                <Text style={styles.sku}>{item.sku}</Text>
                <Text style={styles.label} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
              <Text style={styles.rate}>
                {item.notes === "POA"
                  ? "POA"
                  : `$${item.rate.toFixed(item.rate % 1 ? 2 : 0)}`}
              </Text>
              <Text style={styles.unit}>/{item.unit}</Text>
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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    padding: 12,
    gap: 8,
  },
  rowMain: {
    flex: 1,
  },
  sku: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600",
    color: "#52525B",
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: "#18181B",
  },
  rate: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "600",
    color: "#18181B",
  },
  unit: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#A1A1AA",
    alignSelf: "flex-end",
  },
});
