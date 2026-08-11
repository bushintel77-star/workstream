import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { CrewMember, CrewRole } from "@workstream/contracts";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../../../src/lib/api";

const ROLE_LABEL: Record<CrewRole, string> = {
  lead: "LEAD",
  senior: "SENIOR",
  tradesperson: "TRADE",
  apprentice: "APPRENTICE",
  labourer: "LABOURER",
  subcontractor: "SUB",
};

const ROLES: CrewRole[] = [
  "lead",
  "senior",
  "tradesperson",
  "apprentice",
  "labourer",
  "subcontractor",
];

export default function CrewScreen() {
  const api = useWorkstreamApi();
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrewMember | "new" | null>(null);
  const [form, setForm] = useState<{
    name: string;
    role: CrewRole;
    phone: string;
    email: string;
    hourly_rate: string;
  }>({ name: "", role: "tradesperson", phone: "", email: "", hourly_rate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listCrew();
      setCrew(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load crew");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing("new");
    setForm({
      name: "",
      role: "tradesperson",
      phone: "",
      email: "",
      hourly_rate: "",
    });
  }

  function openEdit(m: CrewMember) {
    setEditing(m);
    setForm({
      name: m.name,
      role: m.role,
      phone: m.phone ?? "",
      email: m.email ?? "",
      hourly_rate: String(m.hourly_rate),
    });
  }

  function close() {
    setEditing(null);
  }

  async function submit() {
    if (form.name.trim().length === 0) {
      setError("Name required");
      return;
    }
    const rate = Number(form.hourly_rate || 0);
    if (!Number.isFinite(rate) || rate < 0) {
      setError("Hourly rate must be a non-negative number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        hourly_rate: rate,
      };
      let member: CrewMember;
      if (editing === "new") {
        member = await api.createCrewMember(payload);
        setCrew((prev) => [...prev, member]);
      } else if (editing) {
        member = await api.updateCrewMember(editing.id, payload);
        setCrew((prev) => prev.map((c) => (c.id === member.id ? member : c)));
      } else {
        return;
      }
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      close();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(member: CrewMember) {
    Alert.alert("Remove crew member?", member.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteCrewMember(member.id);
            setCrew((prev) => prev.filter((c) => c.id !== member.id));
          } catch (e) {
            Alert.alert(
              "Remove failed",
              e instanceof Error ? e.message : "Unknown error",
            );
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.count}>
          {loading ? "…" : `${crew.length} crew · long-press to remove`}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel="Add crew member"
        >
          <Text style={styles.addBtnText}>+ ADD</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          color={tokens.color.accent.default}
        />
      ) : (
        <FlatList
          data={crew}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                !item.active && { opacity: 0.5 },
              ]}
              onPress={() => openEdit(item)}
              onLongPress={() => confirmDelete(item)}
              delayLongPress={350}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.roleLabel}>
                  {ROLE_LABEL[item.role]}
                  {item.hourly_rate > 0 ? `  ·  $${item.hourly_rate}/hr` : ""}
                </Text>
                {item.phone && (
                  <Text style={styles.contact}>{item.phone}</Text>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyKicker}>NO CREW YET</Text>
              <Text style={styles.emptyBody}>
                Add team members so dictated tasks (Mick, Sam …) can be linked
                to real people with rates and contact details.
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={editing != null}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.kicker}>
              {editing === "new" ? "NEW CREW MEMBER" : "EDIT CREW MEMBER"}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Mick"
                placeholderTextColor={tokens.color.ink.tertiary}
                autoFocus
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ROLE</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                    style={[
                      styles.roleChip,
                      form.role === r && styles.roleChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        form.role === r && styles.roleChipTextActive,
                      ]}
                    >
                      {ROLE_LABEL[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>HOURLY RATE</Text>
                <View style={styles.rateRow}>
                  <Text style={styles.dollar}>$</Text>
                  <TextInput
                    style={styles.rateInput}
                    value={form.hourly_rate}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, hourly_rate: v }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={tokens.color.ink.tertiary}
                  />
                </View>
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>PHONE</Text>
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                  keyboardType="phone-pad"
                  placeholder="+61 …"
                  placeholderTextColor={tokens.color.ink.tertiary}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="optional"
                placeholderTextColor={tokens.color.ink.tertiary}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <Pressable
                onPress={close}
                style={styles.secondary}
                disabled={saving}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                style={styles.primary}
                disabled={saving}
              >
                <Text style={styles.primaryText}>
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.surface.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.space[5],
    paddingVertical: tokens.space[3],
  },
  count: {
    fontSize: tokens.type.caption.fontSize,
    fontWeight: tokens.type.caption.fontWeight,
    color: tokens.color.ink.secondary,
  },
  addBtn: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  addBtnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
    opacity: 0.96,
  },
  addBtnText: {
    color: tokens.color.ink.inverted,
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
  },
  loader: { marginTop: tokens.space[7] },
  list: {
    paddingHorizontal: tokens.space[5],
    paddingBottom: tokens.space[5],
    gap: tokens.space[2],
  },
  row: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    padding: tokens.space[4],
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowPressed: {
    backgroundColor: tokens.color.surface.sunken,
    transform: [{ translateY: 1 }],
  },
  name: {
    fontSize: tokens.type.title.fontSize,
    fontWeight: tokens.type.title.fontWeight,
    color: tokens.color.ink.primary,
  },
  roleLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.accent.default,
  },
  contact: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.ink.tertiary,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    padding: tokens.space[5],
    alignItems: "center",
    gap: tokens.space[3],
  },
  emptyKicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  emptyBody: {
    textAlign: "center",
    fontSize: tokens.type.body.fontSize,
    lineHeight: tokens.type.body.lineHeight,
    color: tokens.color.ink.secondary,
    maxWidth: 280,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24,24,27,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: tokens.color.surface.elevated,
    padding: tokens.space[5],
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    gap: tokens.space[3],
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.tertiary,
  },
  field: { gap: tokens.space[2] },
  fieldRow: {
    flexDirection: "row",
    gap: tokens.space[3],
  },
  fieldLabel: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  input: {
    height: 44,
    backgroundColor: tokens.color.surface.sunken,
    paddingHorizontal: tokens.space[3],
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.line.hairline,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
    paddingHorizontal: tokens.space[3],
    height: 44,
  },
  dollar: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.tertiary,
  },
  rateInput: {
    flex: 1,
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.primary,
    fontVariant: ["tabular-nums"],
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space[2],
  },
  roleChip: {
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.sunken,
  },
  roleChipActive: {
    backgroundColor: tokens.color.accent.default,
    borderColor: tokens.color.accent.default,
  },
  roleChipText: {
    fontSize: tokens.type.micro.fontSize,
    fontWeight: tokens.type.micro.fontWeight,
    letterSpacing: tokens.type.micro.letterSpacing,
    color: tokens.color.ink.secondary,
  },
  roleChipTextActive: {
    color: tokens.color.ink.inverted,
  },
  error: {
    fontSize: tokens.type.caption.fontSize,
    color: tokens.color.semantic.block,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.space[3],
    marginTop: tokens.space[2],
  },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.line.strong,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.color.surface.elevated,
  },
  secondaryText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "500",
    color: tokens.color.ink.secondary,
  },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.accent.default,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.inverted,
  },
});
