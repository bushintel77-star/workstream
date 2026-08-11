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
            <Pressable
              onPress={() => void onScan()}
              style={({ pressed }) => [
                styles.aiBtn,
                styles.aiBtnPrimary,
                pressed && styles.aiBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={scanning ? "Scanning site for AI hints" : "Scan site for AI hints"}
              accessibilityHint="Analyse the site aerial and suggest symbol placements"
              accessibilityState={{ disabled: scanning }}
            >
              <Text style={styles.aiBtnText}>{scanning ? "Scanning…" : "Scan site"}</Text>
            </Pressable>
            {ghosts.length > 0 ? (
              <>
                <Pressable
                  onPress={onApplyGhosts}
                  style={({ pressed }) => [styles.aiLinkBtn, pressed && styles.aiBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Apply ${ghosts.length} AI hint${ghosts.length === 1 ? "" : "s"}`}
                  accessibilityHint="Accept all AI-suggested symbol placements onto the plan"
                >
                  <Text style={styles.aiLink}>Apply {ghosts.length}</Text>
                </Pressable>
                <Pressable
                  onPress={onClearGhosts}
                  style={({ pressed }) => [styles.aiLinkBtn, pressed && styles.aiBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear AI hints"
                  accessibilityHint="Dismiss all AI-suggested placements without applying them"
                >
                  <Text style={styles.aiLink}>Clear</Text>
                </Pressable>
              </>
            ) : null}
          </View>
          {ghosts.length > 0 ? (
            <Text
              style={styles.ghostHint}
              accessibilityLiveRegion="polite"
            >
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
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  handle: { backgroundColor: tokens.color.line.strong },
  backdrop: { backgroundColor: "transparent" },
  content: { paddingHorizontal: 12, paddingBottom: 28 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
    marginTop: 8,
    marginBottom: 6,
  },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  aiBtn: {
    minHeight: 44,
    paddingHorizontal: tokens.space[3],
    borderRadius: tokens.radius.pill,
    justifyContent: "center",
  },
  aiBtnPrimary: {
    backgroundColor: tokens.color.accent.soft,
    borderWidth: 1,
    borderColor: tokens.color.accent.default,
  },
  aiBtnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: tokens.color.accent.ink,
  },
  aiLinkBtn: { minHeight: 44, justifyContent: "center" },
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
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface.sunken,
  },
});
