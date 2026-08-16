import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
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
import { DiscoveryAssetCard } from "./DiscoveryAssetCard";

type CategoryFilter = CatalogCategory | "all";

type Props = {
  symbols: CatalogSymbol[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/** Cards beyond this index render without the staggered fan-in delay. */
const FAN_STAGGER_COUNT = 10;
const FAN_STAGGER_MS = 28;

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
      <Text style={styles.title}>Discovery</Text>
      <Text style={styles.subtitle}>Plants, hardscape, structures</Text>

      <TextInput
        style={styles.search}
        placeholder="Search assets…"
        placeholderTextColor={tokens.color.ink.tertiary}
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        accessibilityLabel="Search assets"
        accessibilityHint="Filter the symbol library by name"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsInner}
        accessibilityRole="tablist"
        accessibilityLabel="Asset categories"
      >
        {(["all", ...CATALOG_CATEGORY_ORDER] as CategoryFilter[]).map((cat) => {
          const label = cat === "all" ? "All" : CATALOG_CATEGORY_LABELS[cat];
          return (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                styles.tab,
                category === cat && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              onPress={() => setCategory(cat)}
              disabled={disabled}
              accessibilityRole="tab"
              accessibilityLabel={`${label} category`}
              accessibilityHint={`Filter assets to ${label}`}
              accessibilityState={{ selected: category === cat, disabled }}
            >
              <Text
                style={[
                  styles.tabText,
                  category === cat && styles.tabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/*
       * Discovery HUD — fan-out carousel, not a static grid. Cards stagger
       * in on first render/filter change (Apple-dock "fan-out" from the
       * intelligent-canvas brief); each card itself reveals real botanical
       * metadata on press via DiscoveryAssetCard.
       */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        key={`${category}-${query}`}
      >
        {filtered.map((sym, i) => (
          <Animated.View
            key={sym.id}
            entering={FadeInRight.delay(Math.min(i, FAN_STAGGER_COUNT) * FAN_STAGGER_MS).springify().damping(16)}
          >
            <DiscoveryAssetCard
              symbol={sym}
              active={selectedId === sym.id}
              disabled={disabled}
              onSelect={onSelect}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  wrapDisabled: { opacity: 0.45 },
  title: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: tokens.color.ink.tertiary,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 13, color: tokens.color.ink.secondary },
  search: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    color: tokens.color.ink.primary,
    backgroundColor: tokens.color.surface.base,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tabs: { maxHeight: 44 },
  tabsInner: { gap: 8, paddingVertical: 4 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.base,
  },
  tabActive: {
    borderColor: tokens.color.accent.default,
    backgroundColor: tokens.color.surface.sunken,
  },
  tabPressed: {
    transform: [{ translateY: 1 }],
  },
  tabText: { fontSize: 12, fontWeight: "600", color: tokens.color.ink.secondary },
  tabTextActive: { color: tokens.color.accent.default },
  carousel: {
    flexDirection: "row",
    gap: 10,
  },
});

