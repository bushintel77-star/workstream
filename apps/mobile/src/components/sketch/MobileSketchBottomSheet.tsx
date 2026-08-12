import { forwardRef, useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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

    if (Platform.OS === "web") {
      return (
        <View style={styles.webSheet}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI hints</Text>
            <Text style={styles.sectionMeta}>Subsurface automation for the sketch canvas</Text>
          </View>
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
            <Text style={styles.ghostHint} accessibilityLiveRegion="polite">
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
        </View>
      );
    }

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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI hints</Text>
            <Text style={styles.sectionMeta}>Subsurface automation for the sketch canvas</Text>
          </View>
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
    backgroundColor: "rgba(245, 244, 239, 0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(90, 102, 122, 0.12)",
    shadowColor: "#26303d",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  handle: { backgroundColor: "#6f7e96" },
  backdrop: { backgroundColor: "transparent" },
  webSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(245, 244, 239, 0.94)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(90, 102, 122, 0.12)",
    shadowColor: "#26303d",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  content: { paddingHorizontal: 12, paddingBottom: 28 },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 6,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6f7e96",
  },
  sectionMeta: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#7a8598",
  },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  aiBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: "center",
  },
  aiBtnPrimary: {
    backgroundColor: "rgba(70, 104, 216, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(70, 104, 216, 0.28)",
  },
  aiBtnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  aiBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4668d8",
  },
  aiLinkBtn: { minHeight: 40, justifyContent: "center" },
  aiLink: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#198a68",
    paddingVertical: 8,
  },
  ghostHint: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#b57a18",
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
});
