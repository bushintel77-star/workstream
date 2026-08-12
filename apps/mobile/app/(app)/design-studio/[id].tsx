import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from "react-native-svg";
import BottomSheet from "@gorhom/bottom-sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type {
  CanvasStroke,
  CatalogPlacement,
  CatalogSymbol,
  Survey,
} from "@workstream/contracts";
import type { GhostPlacementSuggestion } from "@workstream/domain";
import {
  buildGhostPlacementSuggestions,
  canvasStrokeToPathD,
  isTier1WrightsTerrace,
  polylineLengthFromCanvasPercent,
  strokePointsToPathD,
  type StrokePointPct,
} from "@workstream/domain";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";
import { DesignAssetGlyph } from "../../../src/components/studio/DesignAssetGlyph";
import { MobileSketchTopbar } from "../../../src/components/sketch/MobileSketchTopbar";
import {
  MobileToolStrip,
  type MobileTool,
} from "../../../src/components/sketch/MobileToolStrip";
import { MobileSketchStatusBar } from "../../../src/components/sketch/MobileSketchStatusBar";
import { MobileSketchBottomSheet } from "../../../src/components/sketch/MobileSketchBottomSheet";
import { MobileSketchIntentRail } from "../../../src/components/sketch/MobileSketchIntentRail";
import { useOfflineQueue } from "../../../src/hooks/useOfflineQueue";

const gestureHandler = Platform.OS === "web" ? null : require("react-native-gesture-handler");
const Gesture = gestureHandler?.Gesture;
const GestureDetector = gestureHandler?.GestureDetector;
// React Native Gesture Handler depends on native view-manager plumbing that
// isn't present on web; use a plain View there and render the web tap path.
const GestureHandlerRootView = gestureHandler?.GestureHandlerRootView ?? View;

type StudioMode = "place" | "draw" | "select" | "measure";

function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function DesignStudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useWorkstreamApi();
  const sheetRef = useRef<BottomSheet>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [symbols, setSymbols] = useState<CatalogSymbol[]>([]);
  const [placements, setPlacements] = useState<CatalogPlacement[]>([]);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [draftPoints, setDraftPoints] = useState<StrokePointPct[]>([]);
  const [mode, setMode] = useState<StudioMode>("place");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 240 });
  const [presentation, setPresentation] = useState(false);
  const [projectAddress, setProjectAddress] = useState("");
  const [redoStrokes, setRedoStrokes] = useState<CanvasStroke[]>([]);
  const [syncLabel, setSyncLabel] = useState<string | undefined>();
  const [ghosts, setGhosts] = useState<GhostPlacementSuggestion[]>([]);
  const [aiScanning, setAiScanning] = useState(false);
  const [measureDraft, setMeasureDraft] = useState<StrokePointPct | null>(null);
  const [measureLabel, setMeasureLabel] = useState<string | null>(null);
  const offline = useOfflineQueue(id ?? "");

  const groundScale = useMemo(
    () => ({
      metresPerXPx: 0.05,
      metresPerYPx: 0.05,
      canvasWidthPx: canvasSize.width,
      canvasHeightPx: canvasSize.height,
    }),
    [canvasSize.height, canvasSize.width],
  );

  const canvasA11yLabel = useMemo(() => {
    const modeLabel = mode[0]!.toUpperCase() + mode.slice(1);
    const parts = [
      `${modeLabel} mode site plan canvas`,
      projectAddress || "Untitled site",
      `${placements.length} symbol${placements.length === 1 ? "" : "s"}`,
      `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`,
    ];
    if (selectedPlacementId) {
      const sel = placements.find((p) => p.id === selectedPlacementId);
      const sym = sel
        ? symbols.find((s) => s.id === sel.symbol_id)
        : undefined;
      if (sym) parts.push(`Selected: ${sym.label}`);
    }
    if (ghosts.length > 0) {
      parts.push(`${ghosts.length} AI hint${ghosts.length === 1 ? "" : "s"} pending`);
    }
    return parts.join(", ");
  }, [mode, projectAddress, placements, strokes.length, selectedPlacementId, ghosts.length, symbols]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, catalog, canvas, project] = await Promise.all([
        api.getSurvey(id),
        api.listCatalogSymbols(),
        api.getDesignCanvas(id),
        api.getProject(id),
      ]);
      setSurvey(s);
      setSymbols(catalog);
      setPlacements(canvas?.placements ?? []);
      setStrokes(canvas?.strokes ?? []);
      setProjectAddress(project.address);
      setRedoStrokes([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load studio");
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || loading) return;
    const timer = setTimeout(() => {
      void api
        .saveDesignCanvas(id, { placements, strokes })
        .then(async () => {
          await offline.saveCache({ placements, strokes });
          setSyncLabel("synced");
          setTimeout(() => setSyncLabel(undefined), 2000);
        })
        .catch(async () => {
          await offline.enqueue({
            timestamp: Date.now(),
            operation: "modify",
            element: { placements, strokes },
          });
          setSyncLabel("offline");
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [api, id, loading, placements, strokes, offline]);

  const symbolById = new Map(symbols.map((s) => [s.id, s]));
  const tier1 = isTier1WrightsTerrace(projectAddress);
  const mobileTool: MobileTool = mode;

  function canvasPoint(e: { locationX: number; locationY: number }): StrokePointPct {
    return {
      x_pct: (e.locationX / canvasSize.width) * 100,
      y_pct: (e.locationY / canvasSize.height) * 100,
    };
  }

  function placeAt(xPct: number, yPct: number) {
    if (!selectedId || mode !== "place") return;
    setPlacements((prev) => [
      ...prev,
      {
        id: newId(),
        symbol_id: selectedId,
        x_pct: xPct,
        y_pct: yPct,
        rotation_deg: 0,
        scale: 1,
      },
    ]);
    setRedoStrokes([]);
  }

  function commitDraft() {
    if (draftPoints.length < 2) {
      setDraftPoints([]);
      return;
    }
    setStrokes((prev) => [
      ...prev,
      {
        id: newId(),
        points: draftPoints,
        color: "#ff2ef6",
        width_px: 2,
      },
    ]);
    setRedoStrokes([]);
    setDraftPoints([]);
  }

  async function handleAiScan() {
    if (!id) return;
    setAiScanning(true);
    try {
      const res = await api.scanDesignGhosts(id);
      setGhosts(res.suggestions);
    } catch {
      setGhosts(
        buildGhostPlacementSuggestions({
          tier1,
          symbolIds: symbols.map((s) => s.id),
        }),
      );
    } finally {
      setAiScanning(false);
    }
  }

  function applyGhosts() {
    if (ghosts.length === 0) return;
    setPlacements((prev) => [
      ...prev,
      ...ghosts.map((g) => ({
        id: newId(),
        symbol_id: g.symbol_id,
        x_pct: g.x_pct,
        y_pct: g.y_pct,
        rotation_deg: 0,
        scale: 1,
      })),
    ]);
    setGhosts([]);
  }

  const drawGesture = Gesture
    ? Gesture.Pan()
        .enabled(mode === "draw")
        .runOnJS(true)
        .onStart((e: { x: number; y: number }) => {
          setDraftPoints([
            {
              x_pct: (e.x / canvasSize.width) * 100,
              y_pct: (e.y / canvasSize.height) * 100,
            },
          ]);
        })
        .onUpdate((e: { x: number; y: number }) => {
          const pt = {
            x_pct: Math.min(100, Math.max(0, (e.x / canvasSize.width) * 100)),
            y_pct: Math.min(100, Math.max(0, (e.y / canvasSize.height) * 100)),
          };
          setDraftPoints((prev) => {
            const last = prev[prev.length - 1];
            if (last && Math.hypot(last.x_pct - pt.x_pct, last.y_pct - pt.y_pct) < 0.5) {
              return prev;
            }
            return [...prev, pt];
          });
        })
        .onEnd(() => commitDraft())
    : null;

  const canvasTone = aiScanning || ghosts.length > 0 ? "info" : offline.offline ? "warn" : "ok";

  const draftPath =
    draftPoints.length >= 2
      ? strokePointsToPathD(draftPoints, canvasSize.width, canvasSize.height, 2)
      : "";

  async function save() {
    if (!id) return;
    setSaving(true);
    try {
      await api.saveDesignCanvas(id, { placements, strokes });
      setError(null);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={tokens.color.accent.default} />
      </SafeAreaView>
    );
  }

  if (!survey) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>Run survey first — site plan required.</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Return to the project screen"
        >
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {!presentation ? (
          <MobileSketchTopbar
            projectId={id ?? ""}
            title={projectAddress || "Site sketch"}
            onBack={() => router.back()}
            presentationMode={presentation}
            onTogglePresentation={() => setPresentation((p) => !p)}
          />
        ) : (
          <Pressable
            style={styles.presentationExit}
            onPress={() => setPresentation(false)}
            accessibilityRole="button"
            accessibilityLabel="Exit presentation"
            accessibilityHint="Restore the toolbars and editing controls"
          >
            <Text style={styles.presentationExitText}>Exit presentation</Text>
          </Pressable>
        )}
        {!presentation ? (
          <>
            <MobileSketchIntentRail
              onVoiceBrief={() =>
                router.push({
                  pathname: "/(app)/recording",
                  params: { projectId: id! },
                })
              }
              onAiSweep={() => void handleAiScan()}
              statusLabel={syncLabel ?? (offline.offline ? "offline queue" : "AI ready")}
              statusTone={canvasTone}
            />
            <MobileSketchStatusBar
              symbolCount={placements.length}
              strokeCount={strokes.length}
              syncLabel={syncLabel ?? (offline.offline ? "offline" : undefined)}
              tier1={tier1}
            />
          </>
        ) : (
          <View style={styles.presentationHud}>
            <Text style={styles.presentationHudText}>
              {placements.length} symbols · {strokes.length} strokes
            </Text>
          </View>
        )}
        {measureLabel ? (
          <Text
            style={styles.measureLabel}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Measurement: ${measureLabel}`}
          >
            {measureLabel}
          </Text>
        ) : null}
        {Platform.OS === "web" ? (
          <Pressable
            style={styles.canvasFlex}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setCanvasSize({ width, height });
            }}
            onPress={(e) => {
              const pt = canvasPoint(e.nativeEvent);
              if (mode === "place") {
                placeAt(pt.x_pct, pt.y_pct);
                return;
              }
              if (mode === "select") {
                setSelectedPlacementId(null);
                return;
              }
              if (mode === "measure") {
                if (!measureDraft) {
                  setMeasureDraft(pt);
                  setMeasureLabel("Tap end point");
                  return;
                }
                const metres = polylineLengthFromCanvasPercent([measureDraft, pt], groundScale);
                setMeasureLabel(`${metres.toFixed(1)} m indicative`);
                setMeasureDraft(null);
              }
            }}
            accessibilityRole="image"
            accessibilityLabel={canvasA11yLabel}
            accessibilityHint="Tap to place the selected symbol in Place mode, select a symbol in Select mode, or measure a distance in Measure mode."
          >
            <Image
              source={{ uri: survey.aerial_uri }}
              style={styles.aerial}
              resizeMode="cover"
            />
            <Svg
              style={StyleSheet.absoluteFill}
              width={canvasSize.width}
              height={canvasSize.height}
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              pointerEvents="none"
            >
              <Defs>
                <Pattern
                  id="sketchDots"
                  x="0"
                  y="0"
                  width="14"
                  height="14"
                  patternUnits="userSpaceOnUse"
                >
                  <Circle cx="1.2" cy="1.2" r="0.7" fill="rgba(255,255,255,0.12)" />
                </Pattern>
                <Pattern
                  id="sketchGlow"
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  patternUnits="userSpaceOnUse"
                >
                  <Rect width="100" height="100" fill="rgba(8, 10, 14, 0.36)" />
                </Pattern>
              </Defs>
              <Rect width={canvasSize.width} height={canvasSize.height} fill="url(#sketchGlow)" />
              <Rect
                width={canvasSize.width}
                height={canvasSize.height}
                fill="url(#sketchDots)"
                opacity={0.55}
              />
              {strokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  d={canvasStrokeToPathD(stroke, canvasSize.width, canvasSize.height)}
                  fill={stroke.color}
                />
              ))}
              {draftPath ? (
                <Path d={draftPath} fill={tokens.color.semantic.info} opacity={0.88} />
              ) : null}
              {measureDraft ? (
                <Line
                  x1={(measureDraft.x_pct / 100) * canvasSize.width}
                  y1={(measureDraft.y_pct / 100) * canvasSize.height}
                  x2={(measureDraft.x_pct / 100) * canvasSize.width}
                  y2={(measureDraft.y_pct / 100) * canvasSize.height}
                  stroke={tokens.color.semantic.warn}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              ) : null}
            </Svg>
            <View style={styles.canvasVeil} pointerEvents="none" />
            {placements.map((p) => {
              const sym = symbolById.get(p.symbol_id);
              if (!sym) return null;
              const selected = selectedPlacementId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.placed,
                    { left: `${p.x_pct}%`, top: `${p.y_pct}%` },
                    selected && styles.placedSelected,
                  ]}
                  onPress={() => {
                    if (mode === "select") setSelectedPlacementId(p.id);
                  }}
                  disabled={mode !== "select"}
                  accessibilityRole="button"
                  accessibilityLabel={`${sym.label}${selected ? ", selected" : ""}`}
                  accessibilityHint="Double tap in Select mode to select this symbol on the plan."
                  accessibilityState={{ selected, disabled: mode !== "select" }}
                >
                  <DesignAssetGlyph symbol={sym} size="pin" />
                </Pressable>
              );
            })}
          </Pressable>
        ) : (
          <GestureDetector gesture={drawGesture}>
            <Pressable
              style={styles.canvasFlex}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (width > 0 && height > 0) setCanvasSize({ width, height });
              }}
              onPress={(e) => {
                const pt = canvasPoint(e.nativeEvent);
                if (mode === "place") {
                  placeAt(pt.x_pct, pt.y_pct);
                  return;
                }
                if (mode === "select") {
                  setSelectedPlacementId(null);
                  return;
                }
                if (mode === "measure") {
                  if (!measureDraft) {
                    setMeasureDraft(pt);
                    setMeasureLabel("Tap end point");
                    return;
                  }
                  const metres = polylineLengthFromCanvasPercent([measureDraft, pt], groundScale);
                  setMeasureLabel(`${metres.toFixed(1)} m indicative`);
                  setMeasureDraft(null);
                }
              }}
              accessibilityRole="image"
              accessibilityLabel={canvasA11yLabel}
              accessibilityHint="Tap to place the selected symbol in Place mode, select a symbol in Select mode, or measure a distance in Measure mode."
            >
              <Image
                source={{ uri: survey.aerial_uri }}
                style={styles.aerial}
                resizeMode="cover"
              />
              <Svg
                style={StyleSheet.absoluteFill}
                width={canvasSize.width}
                height={canvasSize.height}
                viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                pointerEvents="none"
              >
                <Defs>
                  <Pattern
                    id="sketchDots"
                    x="0"
                    y="0"
                    width="14"
                    height="14"
                    patternUnits="userSpaceOnUse"
                  >
                    <Circle cx="1.2" cy="1.2" r="0.7" fill="rgba(255,255,255,0.12)" />
                  </Pattern>
                  <Pattern
                    id="sketchGlow"
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    patternUnits="userSpaceOnUse"
                  >
                    <Rect width="100" height="100" fill="rgba(8, 10, 14, 0.36)" />
                  </Pattern>
                </Defs>
                <Rect width={canvasSize.width} height={canvasSize.height} fill="url(#sketchGlow)" />
                <Rect
                  width={canvasSize.width}
                  height={canvasSize.height}
                  fill="url(#sketchDots)"
                  opacity={0.55}
                />
                {strokes.map((stroke) => (
                  <Path
                    key={stroke.id}
                    d={canvasStrokeToPathD(stroke, canvasSize.width, canvasSize.height)}
                    fill={stroke.color}
                  />
                ))}
                {draftPath ? (
                  <Path d={draftPath} fill={tokens.color.semantic.info} opacity={0.88} />
                ) : null}
                {measureDraft ? (
                  <Line
                    x1={(measureDraft.x_pct / 100) * canvasSize.width}
                    y1={(measureDraft.y_pct / 100) * canvasSize.height}
                    x2={(measureDraft.x_pct / 100) * canvasSize.width}
                    y2={(measureDraft.y_pct / 100) * canvasSize.height}
                    stroke={tokens.color.semantic.warn}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                ) : null}
              </Svg>
              <View style={styles.canvasVeil} pointerEvents="none" />
              {placements.map((p) => {
                const sym = symbolById.get(p.symbol_id);
                if (!sym) return null;
                const selected = selectedPlacementId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.placed,
                      { left: `${p.x_pct}%`, top: `${p.y_pct}%` },
                      selected && styles.placedSelected,
                    ]}
                    onPress={() => {
                      if (mode === "select") setSelectedPlacementId(p.id);
                    }}
                    disabled={mode !== "select"}
                    accessibilityRole="button"
                    accessibilityLabel={`${sym.label}${selected ? ", selected" : ""}`}
                    accessibilityHint="Double tap in Select mode to select this symbol on the plan."
                    accessibilityState={{ selected, disabled: mode !== "select" }}
                  >
                    <DesignAssetGlyph symbol={sym} size="pin" />
                  </Pressable>
                );
              })}
            </Pressable>
          </GestureDetector>
        )}

        {!presentation ? (
          <>
            <MobileToolStrip
              active={mobileTool}
              onTool={(t) => {
                if (t === "draw") {
                  setMode("draw");
                  setSelectedId(null);
                  setMeasureDraft(null);
                } else if (t === "select") {
                  setMode("select");
                } else if (t === "measure") {
                  setMode("measure");
                  setMeasureDraft(null);
                  setMeasureLabel(null);
                } else {
                  setMode("place");
                }
              }}
              onUndo={() => {
                if (draftPoints.length) {
                  setDraftPoints([]);
                  return;
                }
                setStrokes((s) => {
                  if (s.length === 0) return s;
                  const next = s.slice(0, -1);
                  setRedoStrokes((r) => [...r, s[s.length - 1]!]);
                  return next;
                });
              }}
              onRedo={() => {
                setRedoStrokes((r) => {
                  if (r.length === 0) return r;
                  const stroke = r[r.length - 1]!;
                  setStrokes((s) => [...s, stroke]);
                  return r.slice(0, -1);
                });
              }}
              canUndo={draftPoints.length > 0 || strokes.length > 0}
              canRedo={redoStrokes.length > 0}
            />
            <MobileSketchBottomSheet
              ref={sheetRef}
              symbols={symbols}
              selectedId={selectedId}
              onSelectSymbol={setSelectedId}
              paletteDisabled={mode === "draw"}
              ghosts={ghosts}
              scanning={aiScanning}
              onScan={() => void handleAiScan()}
              onApplyGhosts={applyGhosts}
              onClearGhosts={() => setGhosts([])}
            />
          </>
        ) : null}

        {error ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        {!presentation ? (
          <View style={styles.footer}>
            <Pressable
              style={[styles.button, styles.ghost]}
              onPress={() => {
                setPlacements([]);
                setStrokes([]);
                setRedoStrokes([]);
                setDraftPoints([]);
                setGhosts([]);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all"
              accessibilityHint="Remove all symbols, strokes, and AI hints from the plan"
            >
              <Text style={styles.ghostText}>Clear all</Text>
            </Pressable>
            <Pressable
              style={[styles.button, saving && styles.buttonDisabled]}
              onPress={() => void save()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save plan"
              accessibilityHint="Save the current plan and return to the project screen"
              accessibilityState={{ disabled: saving }}
            >
              <Text style={styles.buttonText}>{saving ? "Saving…" : "Save plan"}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const PIN = 18;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#0b0d11" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  measureLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: tokens.color.semantic.warn,
    paddingHorizontal: 12,
  },
  canvasFlex: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#11151b",
  },
  aerial: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.52,
  },
  canvasVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 8, 12, 0.34)",
  },
  placed: {
    position: "absolute",
    marginLeft: -PIN,
    marginTop: -PIN,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  placedSelected: {
    borderWidth: 2,
    borderColor: tokens.color.semantic.info,
    borderRadius: 22,
    shadowColor: tokens.color.semantic.info,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  presentationExit: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(17, 19, 25, 0.94)",
  },
  presentationExitText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: tokens.color.ink.primary,
  },
  presentationHud: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(17, 19, 25, 0.86)",
  },
  presentationHudText: {
    fontSize: 10,
    fontFamily: "monospace",
    color: tokens.color.ink.inverted,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(120, 132, 168, 0.2)",
    backgroundColor: "rgba(17, 19, 25, 0.94)",
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: tokens.color.semantic.info,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  ghost: {
    flex: 0,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(120, 132, 168, 0.24)",
  },
  buttonText: {
    color: tokens.color.ink.inverted,
    fontWeight: "600",
    fontSize: 15,
  },
  ghostText: { color: tokens.color.ink.primary, fontWeight: "600" },
  error: { color: tokens.color.semantic.block, marginTop: 12, paddingHorizontal: 16 },
  link: { color: tokens.color.accent.default, marginTop: 12 },
});
