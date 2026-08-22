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
import { isClerkAPIResponseError, useSignIn } from "@clerk/clerk-expo";
import { tokens } from "@workstream/ui";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err) {
      setError(
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message ?? "Sign in failed"
          : "Sign in failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.kicker}>WORKSTREAM</Text>
        <Text style={styles.title}>Sign in</Text>

        <View style={styles.field}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={tokens.color.ink.tertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            accessibilityLabel="Email address"
            accessibilityHint="Used for your Workstream sign-in"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={tokens.color.ink.tertiary}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={onSignIn}
            accessibilityLabel="Password"
            accessibilityHint="Double tap Sign in to continue"
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={onSignIn}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color={tokens.color.ink.inverted} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-up")}
          accessibilityRole="button"
          accessibilityLabel="Create a new account"
        >
          <Text style={styles.link}>
            Don't have an account?{" "}
            <Text style={styles.linkAccent}>Sign up</Text>
          </Text>
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
    paddingTop: tokens.space[7],
    gap: tokens.space[3],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  title: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
    marginBottom: tokens.space[5],
  },
  field: {
    gap: tokens.space[2],
  },
  label: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  input: {
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
  },
  button: {
    height: 48,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
    marginTop: tokens.space[3],
  },
  buttonText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
  link: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.secondary,
    textAlign: "center",
    marginTop: tokens.space[4],
  },
  linkAccent: {
    color: tokens.color.accent.default,
    fontWeight: "600",
  },
});
