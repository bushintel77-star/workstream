import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { tokens } from "@walkthrough/ui";
import { useWalkthroughApi } from "../../src/lib/api";

export default function NewProjectScreen() {
  const router = useRouter();
  const api = useWalkthroughApi();
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = address.trim().length >= 5 && !submitting;

  async function handleContinue() {
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await api.createProject({ address: address.trim() });
      router.replace(`/(app)/project/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.content}>
        <Text style={styles.kicker}>NEW PROJECT</Text>
        <Text style={styles.heading}>What's the address?</Text>
        <Text style={styles.helper}>
          The survey, design, and costing all flow from here. Use the street
          number and suburb — autocomplete will land in Phase 2.
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.fieldInput}
            value={address}
            onChangeText={setAddress}
            placeholder="36 Wrights Terrace, Prahran"
            placeholderTextColor={tokens.color.ink.tertiary}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleContinue}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
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
    flex: 1,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[5],
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
    marginBottom: tokens.space[4],
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
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
    marginTop: tokens.space[2],
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
