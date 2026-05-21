import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
  type CatalogSymbol,
} from "@workstream/contracts";
import {
  CATALOG_CATEGORY_ORDER,
  filterCatalogSymbols,
} from "@workstream/domain";
import { tokens } from "@workstream/ui";
import { DesignAssetGlyph } from "./DesignAssetGlyph";

type CategoryFilter = CatalogCategory | "all";

type Props = {
  symbols: CatalogSymbol[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

export function DesignAssetPalette({
  symbols,
  selectedId,
  disabled = false,
  onSelect,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterCatalogSymbols(symbols, { category, query }),
    [symbols, category, query],
  );

  return (
    <View style={[styles.wrap, disabled && styles.wrapDisabled]}>
      <Text style={styles.title}>Asset library</Text>
      <Text style={styles.subtitle}>Plants, hardscape, structures</Text>

      <TextInput
        style={styles.search}
        placeholder="Search assets…"
        placeholderTextColor={tokens.color.ink.tertiary}
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsInner}
      >
        {(["all", ...CATALOG_CATEGORY_ORDER] as CategoryFilter[]).map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.tab,
              category === cat && styles.tabActive,
            ]}
            onPress={() => setCategory(cat)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.tabText,
                category === cat && styles.tabTextActive,
              ]}
            >
              {cat === "all" ? "All" : CATALOG_CATEGORY_LABELS[cat]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {filtered.map((sym) => {
          const active = selectedId === sym.id;
          return (
            <Pressable
              key={sym.id}
              style={[
                styles.card,
                { backgroundColor: sym.asset?.preview_bg ?? tokens.color.surface.sunken },
                active && styles.cardActive,
              ]}
              onPress={() => onSelect(sym.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={sym.label}
            >
              <DesignAssetGlyph symbol={sym} size="lg" />
              <Text style={styles.cardLabel} numberOfLines={2}>
                {sym.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  wrapDisabled: { opacity: 0.45 },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: tokens.color.ink.tertiary,
  },
  subtitle: { fontSize: 13, color: tokens.color.ink.secondary },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: tokens.color.ink.primary,
    backgroundColor: tokens.color.surface.base,
  },
  tabs: { maxHeight: 44 },
  tabsInner: { gap: 8, paddingVertical: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.base,
  },
  tabActive: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.surface.sunken,
  },
  tabText: { fontSize: 12, fontWeight: "600", color: tokens.color.ink.secondary },
  tabTextActive: { color: tokens.color.accent.default },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: 100,
    minHeight: 44,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    gap: 6,
  },
  cardActive: { borderColor: tokens.color.accent.default },
  cardLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    color: tokens.color.ink.primary,
  },
});
