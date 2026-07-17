import { forwardRef, useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { tokens } from "@workstream/ui";
import type { CatalogSymbol } from "@workstream/contracts";
import type { GhostPlacementSuggestion } from "@workstream/domain";
import { DesignAssetPalette } from "../studio/DesignAssetPalette";

type Props = {
  symbols: CatalogSymbol[];
  selectedId: string | null;
  onSelectSymbol: (id: string) => void;
  paletteDisabled?: boolean;
  ghosts: GhostPlacementSuggestion[];
  scanning: boolean;
  onScan: () => void;
  onApplyGhosts: () => void;
  onClearGhosts: () => void;
};

export const MobileSketchBottomSheet = forwardRef<BottomSheet, Props>(
  function MobileSketchBottomSheet(
    {
      symbols,
      selectedId,
      onSelectSymbol,
      paletteDisabled,
      ghosts,
      scanning,
      onScan,
      onApplyGhosts,
      onClearGhosts,
    },
    ref,
  ) {
    const snapPoints = useMemo(() => ["22%", "48%", "88%"], []);

    const renderBackdrop = useCallback(
      () => <View style={styles.backdrop} pointerEvents="none" />,
      [],
    );

    return (
      <BottomSheet
        ref={ref}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>AI hints</Text>
          <View style={styles.aiRow}>
            <Pressable onPress={() => void onScan()} accessibilityRole="button">
              <Text style={styles.aiBtn}>{scanning ? "Scanning…" : "Scan site"}</Text>
            </Pressable>
            {ghosts.length > 0 ? (
              <>
                <Pressable onPress={onApplyGhosts} accessibilityRole="button">
                  <Text style={styles.aiLink}>Apply {ghosts.length}</Text>
                </Pressable>
                <Pressable onPress={onClearGhosts} accessibilityRole="button">
                  <Text style={styles.aiLink}>Clear</Text>
                </Pressable>
              </>
            ) : null}
          </View>
          {ghosts.length > 0 ? (
            <Text style={styles.ghostHint}>
              {ghosts.length} ghost hint(s) — confirm before save.
            </Text>
          ) : null}
          <Text style={styles.sectionTitle}>Symbol library</Text>
          <DesignAssetPalette
            symbols={symbols}
            selectedId={selectedId}
            disabled={paletteDisabled}
            onSelect={onSelectSymbol}
          />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: tokens.color.surface.elevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.line.hairline,
  },
  handle: { backgroundColor: tokens.color.line.strong },
  backdrop: { backgroundColor: "transparent" },
  content: { paddingHorizontal: 8, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
    marginTop: 8,
    marginBottom: 6,
  },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  aiBtn: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.accent.default,
    paddingVertical: 8,
    minHeight: 44,
  },
  aiLink: {
    fontSize: 11,
    fontFamily: "monospace",
    color: tokens.color.ink.secondary,
    paddingVertical: 8,
  },
  ghostHint: {
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.ink.secondary,
    marginBottom: 8,
  },
});
