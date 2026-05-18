import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FAFAF7" },
        headerTintColor: "#18181B",
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#FAFAF7" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="rate-card" options={{ title: "Rate Card" }} />
      <Stack.Screen
        name="plant-palette"
        options={{ title: "Plant Palette" }}
      />
      <Stack.Screen name="myob" options={{ title: "MYOB" }} />
    </Stack>
  );
}
