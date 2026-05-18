import { Redirect, Stack } from "expo-router";
import { tokens } from "@walkthrough/ui";
import { useAppAuth } from "../../src/lib/auth";

export default function AppLayout() {
  const { isSignedIn } = useAppAuth();

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen
        name="project/[id]"
        options={{
          headerShown: true,
          title: "Project",
          headerStyle: { backgroundColor: tokens.color.surface.base },
          headerTintColor: tokens.color.ink.primary,
        }}
      />
      <Stack.Screen
        name="new-project"
        options={{
          headerShown: true,
          title: "New Project",
          headerStyle: { backgroundColor: tokens.color.surface.base },
          headerTintColor: tokens.color.ink.primary,
        }}
      />
      <Stack.Screen
        name="recording"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="grid-soil"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
    </Stack>
  );
}
