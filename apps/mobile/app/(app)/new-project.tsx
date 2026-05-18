import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../src/lib/api";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  lat: number;
  lng: number;
};

export default function NewProjectScreen() {
  const router = useRouter();
  const api = useWalkthroughApi();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autocompleteAvailable, setAutocompleteAvailable] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canContinue =
    (selected != null || query.trim().length >= 5) && !submitting;

  useEffect(() => {
    if (selected && selected.place_name === query) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selected && selected.place_name !== query) {
      setSelected(null);
    }
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.geocodeSearch(trimmed);
        setSuggestions(results);
        if (results.length === 0) {
          setAutocompleteAvailable(false);
        } else {
          setAutocompleteAvailable(true);
        }
      } catch {
        setAutocompleteAvailable(false);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, api]);

  function pickSuggestion(s: Suggestion) {
    setSelected(s);
    setQuery(s.place_name);
    setSuggestions([]);
    Keyboard.dismiss();
  }

  async function handleContinue() {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
    try {
      const address = selected?.place_name ?? query.trim();
      const project = await api.createProject({
        address,
        lat: selected?.lat,
        lng: selected?.lng,
      });
      router.replace(`/(app)/project/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.kicker}>NEW PROJECT</Text>
        <Text style={styles.heading}>What's the address?</Text>
        <Text style={styles.helper}>
          {autocompleteAvailable
            ? "AU addresses, Mapbox-powered. Pick a result for an exact lot match."
            : "Autocomplete unavailable. Enter the full street address manually."}
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.fieldInput}
            value={query}
            onChangeText={setQuery}
            placeholder="36 Wrights Terrace, Prahran"
            placeholderTextColor={tokens.color.ink.tertiary}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator
              style={styles.spinner}
              color={tokens.color.accent.default}
            />
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.suggestion,
                  pressed && { backgroundColor: tokens.color.surface.sunken },
                ]}
                onPress={() => pickSuggestion(s)}
                accessibilityRole="button"
                accessibilityLabel={s.place_name}
              >
                <Text style={styles.suggestionPrimary}>{s.text}</Text>
                <Text style={styles.suggestionSecondary} numberOfLines={1}>
                  {s.place_name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {selected && (
          <View style={styles.selectedCard}>
            <Text style={styles.cardLabel}>PINNED</Text>
            <Text style={styles.selectedAddress}>{selected.place_name}</Text>
            <Text style={styles.selectedCoords}>
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="Create project"
          accessibilityState={{ disabled: !canContinue, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={tokens.color.ink.inverted} />
          ) : (
            <Text style={styles.buttonText}>Create project →</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  content: {
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[5],
    paddingBottom: tokens.space[6],
    gap: tokens.space[3],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  heading: {
    fontSize: tokens.type.displayM.fontSize,
    lineHeight: tokens.type.displayM.lineHeight,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  helper: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
    marginBottom: tokens.space[3],
  },
  field: {
    gap: tokens.space[2],
  },
  fieldLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  fieldInput: {
    height: 48,
    backgroundColor: tokens.color.surface.sunken,
    paddingHorizontal: tokens.space[4],
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
    borderBottomWidth: 2,
    borderBottomColor: tokens.color.ink.primary,
  },
  spinner: {
    position: "absolute",
    right: tokens.space[3],
    top: 36,
  },
  suggestions: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line.hairline,
    gap: 2,
  },
  suggestionPrimary: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  suggestionSecondary: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
  },
  selectedCard: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.accent.default,
    padding: tokens.space[4],
    gap: 4,
  },
  cardLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.ink,
  },
  selectedAddress: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
  },
  selectedCoords: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  footer: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[4],
  },
  button: {
    height: 56,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: tokens.color.line.strong,
  },
  buttonText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
});
