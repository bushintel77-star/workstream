import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";
import { tokenCache } from "../src/lib/clerk";
import { isAuthEnabled, isAuthMisconfigured } from "../src/lib/auth";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function StackRoot() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.color.surface.base },
          headerTintColor: tokens.color.ink.primary,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function AuthSetupRequired() {
  return (
    <View style={authStyles.container}>
      <Text style={authStyles.kicker}>WORKSTREAM</Text>
      <Text style={authStyles.heading}>Sign-in required</Text>
      <Text style={authStyles.body}>
        Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env (and deploy
        CLERK_SECRET_KEY on the API) before using this build.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  if (isAuthMisconfigured) {
    return <AuthSetupRequired />;
  }
  if (!isAuthEnabled) {
    return <StackRoot />;
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <StackRoot />
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: tokens.space[6],
    backgroundColor: tokens.color.surface.base,
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
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  body: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
});
