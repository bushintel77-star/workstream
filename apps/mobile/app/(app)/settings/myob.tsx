import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type {
  MyobItem,
  MyobSyncStatus,
  RateCard,
  SkuLink,
} from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";

export default function MyobScreen() {
  const api = useWorkstreamApi();
  const [status, setStatus] = useState<MyobSyncStatus | null>(null);
  const [rateCard, setRateCard] = useState<RateCard[]>([]);
  const [items, setItems] = useState<MyobItem[]>([]);
  const [links, setLinks] = useState<SkuLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<RateCard | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, rc, it, sl] = await Promise.all([
        api.myobStatus(),
        api.listRateCard(),
        api.myobItems(),
        api.myobSkuLinks(),
      ]);
      setStatus(s);
      setRateCard(rc);
      setItems(it);
      setLinks(sl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "MYOB load failed");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const linkBySku = useMemo(() => {
    const m = new Map<string, SkuLink>();
    for (const l of links) m.set(l.rate_card_sku, l);
    return m;
  }, [links]);

  const itemByNumber = useMemo(() => {
    const m = new Map<string, MyobItem>();
    for (const i of items) m.set(i.number, i);
    return m;
  }, [items]);

  async function selectMatch(item: MyobItem) {
    if (!picker) return;
    setSaving(true);
    try {
      const link = await api.myobUpsertSkuLink({
        rate_card_sku: picker.sku,
        myob_uid: item.uid,
        myob_item_number: item.number,
      });
      setLinks((prev) => {
        const others = prev.filter((l) => l.rate_card_sku !== link.rate_card_sku);
        return [...others, link];
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setPicker(null);
      // refresh status to recompute sku_match_pct
      const s = await api.myobStatus();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          color={tokens.color.accent.default}
        />
      ) : (
        <>
          <View style={styles.statusCard}>
            <Text style={styles.statusKicker}>
              {status?.connected ? "LIVE" : "DEV FALLBACK"}
            </Text>
            <View style={styles.statusGrid}>
              <Metric label="CUSTOMERS" value={String(status?.customers_cached ?? 0)} />
              <Metric label="ITEMS" value={String(status?.items_cached ?? 0)} />
              <Metric label="SKU MATCH" value={`${status?.sku_match_pct ?? 0}%`} />
            </View>
            {!status?.connected && (
              <Text style={styles.helper}>
                Set MYOB_ACCESS_TOKEN + MYOB_COMPANY_FILE_ID on the API to
                connect a real company file.
              </Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <Text style={styles.sectionKicker}>
            RATE CARD ↔ MYOB ITEM  ·  {rateCard.length} SKUs
          </Text>

          <FlatList
            data={rateCard}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => {
              const link = linkBySku.get(row.sku);
              const matched = link ? itemByNumber.get(link.myob_item_number) : null;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => setPicker(row)}
                  accessibilityRole="button"
                  accessibilityLabel={`Match ${row.sku}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowSku}>{row.sku}</Text>
                    <Text style={styles.rowLabel} numberOfLines={2}>
                      {row.label}
                    </Text>
                    {link ? (
                      <Text style={styles.rowMatched}>
                        → {link.myob_item_number}
                        {matched ? ` · ${matched.name}` : ""}
                      </Text>
                    ) : (
                      <Text style={styles.rowUnmatched}>Not matched</Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            }}
          />
        </>
      )}

      <Modal
        visible={picker != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.statusKicker}>SELECT MYOB ITEM</Text>
            {picker && (
              <>
                <Text style={styles.modalSku}>{picker.sku}</Text>
                <Text style={styles.modalLabel} numberOfLines={2}>
                  {picker.label}
                </Text>
              </>
            )}
            <FlatList
              data={items}
              keyExtractor={(i) => i.uid}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.itemRow,
                    pressed && styles.itemRowPressed,
                  ]}
                  onPress={() => selectMatch(item)}
                  disabled={saving}
                >
                  <Text style={styles.itemNumber}>{item.number}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ${item.base_selling_price.toFixed(0)}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => setPicker(null)}
              style={styles.cancelBtn}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  loader: {
    marginTop: tokens.space[7],
  },
  statusCard: {
    margin: tokens.space[5],
    padding: tokens.space[4],
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    gap: tokens.space[3],
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statusKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  statusGrid: {
    flexDirection: "row",
    gap: tokens.space[5],
  },
  metric: { gap: 2 },
  metricLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  metricValue: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  helper: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  sectionKicker: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[2],
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  list: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[5],
    gap: tokens.space[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    padding: tokens.space[3],
    gap: tokens.space[3],
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowPressed: {
    backgroundColor: tokens.color.surface.sunken,
    transform: [{ translateY: 1 }],
  },
  rowSku: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.ink.secondary,
  },
  rowLabel: {
    marginTop: 2,
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  rowMatched: {
    marginTop: 4,
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.ok,
    fontFamily: "monospace",
  },
  rowUnmatched: {
    marginTop: 4,
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
  },
  chevron: {
    fontSize: 20,
    color: tokens.color.ink.tertiary,
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
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalSku: {
    fontFamily: "monospace",
    fontSize: tokens.type.bodyMono.fontSize,
    color: tokens.color.ink.secondary,
  },
  modalLabel: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    paddingVertical: tokens.space[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line.hairline,
  },
  itemRowPressed: {
    backgroundColor: tokens.color.surface.sunken,
    transform: [{ translateY: 1 }],
  },
  itemNumber: {
    fontFamily: "monospace",
    fontSize: 12,
    color: tokens.color.ink.secondary,
    minWidth: 90,
  },
  itemName: {
    flex: 1,
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  itemPrice: {
    fontFamily: "monospace",
    fontSize: tokens.type.bodyMono.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
    minWidth: 56,
    textAlign: "right",
  },
  cancelBtn: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.secondary,
  },
});
