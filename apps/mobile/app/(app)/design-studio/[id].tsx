import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type {
  CanvasStroke,
  CatalogPlacement,
  CatalogSymbol,
  Survey,
} from "@workstream/contracts";
import {
  canvasStrokeToPathD,
  strokePointsToPathD,
  type StrokePointPct,
} from "@workstream/domain";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";
import { DesignAssetGlyph } from "../../../src/components/studio/DesignAssetGlyph";
import { DesignAssetPalette } from "../../../src/components/studio/DesignAssetPalette";

type StudioMode = "place" | "draw";

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

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [symbols, setSymbols] = useState<CatalogSymbol[]>([]);
  const [placements, setPlacements] = useState<CatalogPlacement[]>([]);
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [draftPoints, setDraftPoints] = useState<StrokePointPct[]>([]);
  const [mode, setMode] = useState<StudioMode>("place");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 240 });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, catalog, canvas] = await Promise.all([
        api.getSurvey(id),
        api.listCatalogSymbols(),
        api.getDesignCanvas(id),
      ]);
      setSurvey(s);
      setSymbols(catalog);
      setPlacements(canvas?.placements ?? []);
      setStrokes(canvas?.strokes ?? []);
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

  const symbolById = new Map(symbols.map((s) => [s.id, s]));

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
    setDraftPoints([]);
  }

  const drawGesture = Gesture.Pan()
    .enabled(mode === "draw")
    .runOnJS(true)
    .onStart((e) => {
      setDraftPoints([
        {
          x_pct: (e.x / canvasSize.width) * 100,
          y_pct: (e.y / canvasSize.height) * 100,
        },
      ]);
    })
    .onUpdate((e) => {
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
    .onEnd(() => commitDraft());

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
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>DESIGN STUDIO</Text>
        <Text style={styles.heading}>Plan on aerial</Text>

        <View style={styles.toolbar}>
          <Pressable
            style={[styles.modeBtn, mode === "place" && styles.modeBtnActive]}
            onPress={() => setMode("place")}
          >
            <Text
              style={[
                styles.modeBtnText,
                mode === "place" && styles.modeBtnTextActive,
              ]}
            >
              Place
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === "draw" && styles.modeBtnActive]}
            onPress={() => {
              setMode("draw");
              setSelectedId(null);
            }}
          >
            <Text
              style={[
                styles.modeBtnText,
                mode === "draw" && styles.modeBtnTextActive,
              ]}
            >
              Draw
            </Text>
          </Pressable>
          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              draftPoints.length ? setDraftPoints([]) : setStrokes((s) => s.slice(0, -1))
            }
          >
            <Text style={styles.toolBtnText}>Undo</Text>
          </Pressable>
        </View>

        <GestureDetector gesture={drawGesture}>
          <Pressable
            style={styles.canvas}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (width > 0 && height > 0) setCanvasSize({ width, height });
            }}
            onPress={(e) => {
              if (mode !== "place") return;
              placeAt(
                (e.nativeEvent.locationX / canvasSize.width) * 100,
                (e.nativeEvent.locationY / canvasSize.height) * 100,
              );
            }}
            accessibilityLabel="Site plan canvas"
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
              {strokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  d={canvasStrokeToPathD(
                    stroke,
                    canvasSize.width,
                    canvasSize.height,
                  )}
                  fill={stroke.color}
                />
              ))}
              {draftPath ? <Path d={draftPath} fill="#ff2ef6" opacity={0.85} /> : null}
            </Svg>
            {placements.map((p) => {
              const sym = symbolById.get(p.symbol_id);
              if (!sym) return null;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.placed,
                    { left: `${p.x_pct}%`, top: `${p.y_pct}%` },
                  ]}
                  pointerEvents="none"
                >
                  <DesignAssetGlyph symbol={sym} size="pin" />
                </View>
              );
            })}
          </Pressable>
        </GestureDetector>

        <DesignAssetPalette
          symbols={symbols}
          selectedId={selectedId}
          disabled={mode === "draw"}
          onSelect={setSelectedId}
        />

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, styles.ghost]}
          onPress={() => {
            setPlacements([]);
            setStrokes([]);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.ghostText}>Clear all</Text>
        </Pressable>
        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={() => void save()}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {saving ? "Saving…" : "Save plan"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const PIN = 18;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.color.surface.base },
  scroll: { padding: 20, paddingBottom: 100 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: tokens.color.ink.tertiary,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: tokens.color.ink.primary,
    marginTop: 4,
    marginBottom: 12,
  },
  toolbar: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    justifyContent: "center",
  },
  modeBtnActive: {
    backgroundColor: tokens.color.accent.default,
    borderColor: tokens.color.accent.default,
  },
  modeBtnText: { fontWeight: "600", color: tokens.color.ink.primary },
  modeBtnTextActive: { color: tokens.color.ink.inverted },
  toolBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    justifyContent: "center",
  },
  toolBtnText: { fontWeight: "600", color: tokens.color.ink.primary },
  canvas: {
    minHeight: 240,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
  },
  aerial: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  placed: {
    position: "absolute",
    marginLeft: -PIN,
    marginTop: -PIN,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.color.line.hairline,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: tokens.color.accent.default,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  ghost: {
    flex: 0,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
  },
  buttonText: {
    color: tokens.color.ink.inverted,
    fontWeight: "600",
    fontSize: 15,
  },
  ghostText: { color: tokens.color.ink.primary, fontWeight: "600" },
  error: { color: tokens.color.semantic.block, marginTop: 12 },
  link: { color: tokens.color.accent.default, marginTop: 12 },
});
