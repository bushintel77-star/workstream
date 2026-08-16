import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@workstream/ui";
import { useWorkstreamApi } from "../lib/api";

export function WebPreviewHome() {
  const api = useWorkstreamApi();
  const [status, setStatus] = useState("Loading projects...");

  useEffect(() => {
    let active = true;
    api
      .listProjects()
      .then((projects) => {
        if (!active) return;
        setStatus(`${projects.length} project${projects.length === 1 ? "" : "s"} ready`);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "Preview loaded");
      });
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <View style={styles.shell}>
      <Text style={styles.kicker}>CURTIS & CO</Text>
      <Text style={styles.title}>Workstream</Text>
      <Text style={styles.body}>{status}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>New project</Text>
      </View>
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Open mobile preview</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    padding: tokens.space[6],
    gap: tokens.space[3],
    justifyContent: "center",
    backgroundColor: tokens.color.surface.base,
  },
  kicker: {
    fontSize: tokens.type.micro.fontSize,
    letterSpacing: tokens.type.micro.letterSpacing,
    fontWeight: tokens.type.micro.fontWeight,
    color: tokens.color.ink.tertiary,
  },
  title: {
    fontSize: tokens.type.displayM.fontSize,
    fontWeight: tokens.type.displayM.fontWeight,
    color: tokens.color.ink.primary,
  },
  body: {
    fontSize: tokens.type.body.fontSize,
    color: tokens.color.ink.secondary,
  },
  card: {
    minHeight: 88,
    justifyContent: "center",
    padding: tokens.space[4],
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.line.hairline,
    backgroundColor: tokens.color.surface.elevated,
  },
  cardLabel: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  button: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: tokens.space[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.accent.default,
  },
  buttonText: {
    fontSize: tokens.type.body.fontSize,
    fontWeight: "600",
    color: tokens.color.surface.base,
  },
});
