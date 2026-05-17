import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { RateCard } from "@walkthrough/contracts";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../../src/lib/api";

const formatRate = (item: RateCard) => {
  if (item.notes === "POA") return "POA";
  return item.rate % 1
    ? `$${item.rate.toFixed(2)}`
    : `$${item.rate.toFixed(0)}`;
};

export default function RateCardScreen() {
  const api = useWalkthroughApi();
  const [items, setItems] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RateCard | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listRateCard();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [api]);

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

  const openEdit = useCallback((item: RateCard) => {
    setEditing(item);
    setError(null);
    setRateInput(item.notes === "POA" ? "" : String(item.rate));
  }, []);

  const closeEdit = useCallback(() => {
    setEditing(null);
    setRateInput("");
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!editing) return;
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Rate must be a non-negative number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRateCardItem(editing.sku, {
        rate: parsed,
        notes: editing.notes === "POA" ? "" : editing.notes,
      });
      setItems((prev) =>
        prev.map((it) => (it.sku === updated.sku ? updated : it)),
      );
      closeEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }, [api, editing, rateInput, closeEdit]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Text style={styles.count}>
        {loading ? "…" : `${items.length} items · tap to edit rate`}
      </Text>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={tokens.color.accent.default} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: tokens.color.surface.sunken },
              ]}
              onPress={() => openEdit(item)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.sku}>{item.sku}</Text>
                <Text style={styles.label} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
              <Text style={styles.rate}>{formatRate(item)}</Text>
              <Text style={styles.unit}>/{item.unit}</Text>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={editing != null}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>EDIT RATE</Text>
            {editing && (
              <>
                <Text style={styles.modalSku}>{editing.sku}</Text>
                <Text style={styles.modalLabel}>{editing.label}</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={rateInput}
                    onChangeText={setRateInput}
                    keyboardType="decimal-pad"
                    autoFocus
                    placeholder="0.00"
                    placeholderTextColor={tokens.color.ink.tertiary}
                  />
                  <Text style={styles.perUnit}>/ {editing.unit}</Text>
                </View>
                {error && <Text style={styles.error}>{error}</Text>}
                <View style={styles.actions}>
                  <Pressable
                    onPress={closeEdit}
                    style={styles.secondary}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    style={styles.primary}
                    disabled={saving}
                  >
                    <Text style={styles.primaryText}>
                      {saving ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    padding: tokens.space[3],
    gap: tokens.space[2],
  },
  rowMain: {
    flex: 1,
  },
  sku: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.ink.secondary,
    marginBottom: 4,
  },
  label: {
    fontSize: tokens.type.bodyMono.fontSize,
    color: tokens.color.ink.primary,
  },
  rate: {
    fontFamily: "monospace",
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  unit: {
    fontFamily: "monospace",
    fontSize: 12,
    color: tokens.color.ink.tertiary,
    alignSelf: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24,24,27,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: tokens.color.surface.elevated,
    padding: tokens.space[5],
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    gap: tokens.space[3],
  },
  modalKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  modalSku: {
    fontFamily: "monospace",
    fontSize: tokens.type.bodyMono.fontSize,
    color: tokens.color.ink.secondary,
  },
  modalLabel: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
    paddingVertical: tokens.space[3],
    borderBottomWidth: 2,
    borderBottomColor: tokens.color.ink.primary,
  },
  dollar: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  input: {
    flex: 1,
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
  perUnit: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.tertiary,
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.space[3],
    marginTop: tokens.space[3],
  },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.strong,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
    color: tokens.color.ink.secondary,
  },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
});
