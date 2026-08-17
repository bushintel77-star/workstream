import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { CatalogSymbol } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { DesignAssetGlyph } from "./DesignAssetGlyph";

type Props = {
  symbol: CatalogSymbol;
  active: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/**
 * Discovery HUD card — the "Apple-style dock" tactile unit from the
 * intelligent-canvas brief. Press-in (the touch equivalent of desktop
 * hover) triggers a 110% scale + a real botanical metadata reveal
 * (mature height / spread from the real catalogue, never invented).
 * Selection keeps a persistent Gold Standard ring.
 */
export function DiscoveryAssetCard({ symbol, active, disabled = false, onSelect }: Props) {
  const scale = useSharedValue(1);
  const revealed = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: revealed.value,
    transform: [{ translateY: (1 - revealed.value) * 6 }],
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1.1, { damping: 14, stiffness: 220 });
    revealed.value = withTiming(1, { duration: 160 });
  }, [disabled, revealed, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 16, stiffness: 220 });
    revealed.value = withTiming(0, { duration: 140 });
  }, [revealed, scale]);

  const metaLine = [
    symbol.mature_height_m ? `H ${symbol.mature_height_m.toFixed(1)}m` : null,
    symbol.default_width_m ? `W ${symbol.default_width_m.toFixed(1)}m` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Animated.View style={[styles.wrap, cardStyle]}>
      <Pressable
        style={[
          styles.card,
          active && styles.cardActive,
          disabled && styles.cardDisabled,
        ]}
        onPress={() => onSelect(symbol.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={symbol.label}
        accessibilityHint="Select this symbol, then tap the plan to place it"
        accessibilityState={{ selected: active, disabled }}
      >
        <View
          style={[
            styles.glyphWell,
            { backgroundColor: symbol.asset?.preview_bg ?? tokens.color.surface.sunken },
          ]}
        >
          <DesignAssetGlyph symbol={symbol} size="lg" />
        </View>

        <Text style={styles.cardLabel} numberOfLines={2}>
          {symbol.label}
        </Text>
        {symbol.botanical_name || metaLine ? (
          <Animated.View style={[styles.metaReveal, metaStyle]} pointerEvents="none">
            {symbol.botanical_name ? (
              <Text style={styles.metaBotanical} numberOfLines={1}>
                {symbol.botanical_name}
              </Text>
            ) : null}
            {metaLine ? (
              <Text style={styles.metaLine} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 108 },
  card: {
    width: 108,
    minHeight: 44,
    padding: 10,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.10)",
    alignItems: "center",
    gap: 6,
    // Glass-HUD surface: frost panel (--gs-panel-frost) so the discovery
    // carousel reads as an overlay above the paper plan, not an opaque sheet.
    backgroundColor: "rgba(255, 255, 255, 0.86)",
  },
  cardActive: { borderColor: tokens.color.studio.gold, borderWidth: 2 },
  cardDisabled: { opacity: 0.45 },
  glyphWell: {
    width: 56,
    height: 56,
    borderRadius: tokens.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    color: tokens.color.ink.primary,
  },
  metaReveal: {
    alignItems: "center",
    gap: 1,
  },
  metaBotanical: {
    fontSize: 9,
    fontStyle: "italic",
    color: tokens.color.ink.secondary,
    textAlign: "center",
  },
  metaLine: {
    fontSize: 9,
    fontFamily: "monospace",
    color: tokens.color.studio.gold,
    textAlign: "center",
  },
});
