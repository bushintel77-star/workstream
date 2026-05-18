import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppAuth } from "../../../src/lib/auth";

const ROWS = [
  { label: "Crew", href: "/(app)/settings/crew" as const },
  { label: "Rate Card", href: "/(app)/settings/rate-card" as const },
  { label: "Plant Palette", href: "/(app)/settings/plant-palette" as const },
  { label: "MYOB", href: "/(app)/settings/myob" as const },
] as const;

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { signOut } = useAppAuth();

  return (
    <View style={styles.container}>
      <View style={styles.cards}>
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
            style={styles.card}
            onPress={() => router.push(row.href)}
          >
            <Text style={styles.cardLabel}>{row.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.signOutButton} onPress={() => signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cards: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#18181B",
  },
  chevron: {
    fontSize: 20,
    color: "#A1A1AA",
    fontWeight: "300",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 32,
    alignItems: "center",
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#B91C1C",
  },
});
