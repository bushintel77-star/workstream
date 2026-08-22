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
import { isClerkAPIResponseError, useSignUp } from "@clerk/clerk-expo";
import { tokens } from "@workstream/ui";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSignUp = async () => {
    if (!isLoaded) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message ?? "Sign up failed"
          : "Sign up failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
      }
    } catch (err) {
      setError(
        isClerkAPIResponseError(err)
          ? err.errors[0]?.message ?? "Verification failed"
          : "Verification failed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.kicker}>WORKSTREAM</Text>
          <Text style={styles.title}>Verify email</Text>

          <View style={styles.field}>
            <Text style={styles.label}>VERIFICATION CODE</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={tokens.color.ink.tertiary}
              keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={onVerify}
            accessibilityLabel="Email verification code"
            accessibilityHint="Enter the six-digit code from your email"
            />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={styles.button}
            onPress={onVerify}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Verify email code"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={tokens.color.ink.inverted} />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.kicker}>WORKSTREAM</Text>
        <Text style={styles.title}>Create account</Text>

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
            accessibilityHint="Used to create your Workstream account"
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
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            accessibilityLabel="Password"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={tokens.color.ink.tertiary}
            secureTextEntry
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={onSignUp}
            accessibilityLabel="Confirm password"
            accessibilityHint="Must match your password"
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={onSignUp}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color={tokens.color.ink.inverted} />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          accessibilityRole="button"
          accessibilityLabel="Sign in with an existing account"
        >
          <Text style={styles.link}>
            Already have an account?{" "}
            <Text style={styles.linkAccent}>Sign in</Text>
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
