import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@workstream/ui";
import { useAppAuth } from "../../../src/lib/auth";

const ROWS = [
  { label: "Crew", href: "/(app)/settings/crew" as const },
  { label: "Rate card", href: "/(app)/settings/rate-card" as const },
  { label: "Plant palette", href: "/(app)/settings/plant-palette" as const },
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
    backgroundColor: tokens.color.surface.base,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[4],
  },
  cards: {
    gap: tokens.space[2],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
  },
  cardLabel: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
    color: tokens.color.ink.primary,
  },
  chevron: {
    fontSize: 20,
    color: tokens.color.ink.tertiary,
    fontWeight: "300",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: tokens.space[6],
    alignItems: "center",
  },
  signOutButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[5],
  },
  signOutText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
    color: tokens.color.semantic.block,
  },
});
