import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { tokens } from "@workstream/ui";
import type { Task } from "@workstream/contracts";
import { GARDEN_COPY, type SiteNextAction } from "@workstream/domain";

const STATUS_LABEL: Record<Task["status"], string> = {
  pending: "To do",
  in_progress: "On it",
  blocked: "Stuck",
  done: "Done",
  cancelled: "Dropped",
};

type WorkflowStep = {
  label: string;
  done: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  tasks: Task[];
  workflow: WorkflowStep[];
  next: SiteNextAction;
};

export function OutstandingSheet({
  visible,
  onClose,
  tasks,
  workflow,
  next,
}: Props) {
  const open = tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "in_progress" ||
      t.status === "blocked",
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{GARDEN_COPY.tasks.sheetTitle}</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>Done</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>{GARDEN_COPY.tasks.workflowTitle}</Text>
        <View style={styles.nextBox}>
          <Text style={styles.nextLabel}>{next.label}</Text>
          {next.sub ? <Text style={styles.nextSub}>{next.sub}</Text> : null}
        </View>
        {workflow.map((step) => (
          <View key={step.label} style={styles.stepRow}>
            <Text style={styles.stepMark}>{step.done ? "Done" : "—"}</Text>
            <Text
              style={[styles.stepLabel, step.done && styles.stepLabelDone]}
            >
              {step.label}
            </Text>
          </View>
        ))}

        <Text style={[styles.section, { marginTop: tokens.space[5] }]}>
          Tasks on this job
        </Text>
        {open.length === 0 ? (
          <Text style={styles.empty}>{GARDEN_COPY.tasks.none}</Text>
        ) : (
          open.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <Text style={styles.taskTitle}>{t.title}</Text>
              <Text style={styles.taskMeta}>
                {STATUS_LABEL[t.status]} · {t.priority}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: tokens.space[4],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line.hairline,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.color.ink.primary,
  },
  close: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.color.accent.default,
  },
  body: {
    padding: tokens.space[4],
    paddingBottom: tokens.space[8],
  },
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tokens.color.ink.tertiary,
    marginBottom: tokens.space[2],
  },
  nextBox: {
    backgroundColor: tokens.color.surface.sunken,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
    marginBottom: tokens.space[3],
  },
  nextLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: tokens.color.ink.primary,
  },
  nextSub: {
    fontSize: 13,
    color: tokens.color.ink.secondary,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[2],
    paddingVertical: 6,
  },
  stepMark: {
    width: 20,
    fontSize: 14,
    color: tokens.color.accent.default,
  },
  stepLabel: {
    fontSize: 15,
    color: tokens.color.ink.primary,
  },
  stepLabelDone: {
    color: tokens.color.ink.tertiary,
    textDecorationLine: "line-through",
  },
  empty: {
    fontSize: 14,
    color: tokens.color.ink.secondary,
    fontStyle: "italic",
  },
  taskRow: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.line.hairline,
    paddingVertical: tokens.space[3],
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.color.ink.primary,
  },
  taskMeta: {
    fontSize: 12,
    color: tokens.color.ink.tertiary,
    marginTop: 2,
  },
});
