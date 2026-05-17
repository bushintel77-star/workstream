import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
  const { isSignedIn } = useAuth();

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
          headerStyle: { backgroundColor: "#FAFAF7" },
          headerTintColor: "#18181B",
        }}
      />
      <Stack.Screen
        name="new-project"
        options={{
          headerShown: true,
          title: "New Project",
          headerStyle: { backgroundColor: "#FAFAF7" },
          headerTintColor: "#18181B",
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
    </Stack>
  );
}
