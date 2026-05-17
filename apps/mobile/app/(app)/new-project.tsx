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
      const project = await api.createProject({
        address: address.trim(),
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
      <View style={styles.content}>
        <Text style={styles.heading}>New Project</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.fieldInput}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter project address"
            placeholderTextColor="#A1A1AA"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAF7",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#18181B",
    marginBottom: 24,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.44,
    color: "#52525B",
  },
  fieldInput: {
    height: 48,
    borderRadius: 4,
    backgroundColor: "#F4F4F1",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#18181B",
    borderBottomWidth: 1,
    borderBottomColor: "#D4D4D8",
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: "#B91C1C",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: "#C2410C",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
