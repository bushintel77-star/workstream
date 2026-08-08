import { Stack } from "expo-router";
import { tokens } from "@workstream/ui";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.surface.base },
        headerTintColor: tokens.color.ink.primary,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.color.surface.base },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="rate-card" options={{ title: "Rate card" }} />
      <Stack.Screen
        name="plant-palette"
        options={{ title: "Plant palette" }}
      />
      <Stack.Screen name="myob" options={{ title: "MYOB" }} />
      <Stack.Screen name="crew" options={{ title: "Crew" }} />
    </Stack>
  );
}
