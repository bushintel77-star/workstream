import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>WORKSTREAM SETTINGS</Text>
        <Text style={styles.heading}>Crew, rates, plants, and MYOB</Text>
        <Text style={styles.subheading}>
          Keep the field kit aligned with the studio register.
        </Text>
      </View>

      <View style={styles.cards}>
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(row.href)}
          >
            <Text style={styles.cardLabel}>{row.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: tokens.color.surface.base,
    paddingHorizontal: tokens.space[4],
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[6],
    gap: tokens.space[4],
  },
  hero: {
    marginHorizontal: tokens.space[1],
    padding: tokens.space[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: tokens.space[2],
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
  },
  heading: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  subheading: {
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
  },
  cards: {
    gap: tokens.space[2],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    paddingTop: tokens.space[2],
    alignItems: "center",
  },
  signOutButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[5],
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.semantic.block,
    backgroundColor: tokens.color.surface.elevated,
  },
  signOutText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
    color: tokens.color.semantic.block,
  },
  signOutPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.96,
  },
  cardPressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.96,
  },
});
