import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../tokens';

type Severity = 'ok' | 'warn' | 'block' | 'info';

interface FlagProps {
  severity: Severity;
  label: string;
}

const severityColorMap: Record<Severity, string> = {
  ok: tokens.color.semantic.ok,
  warn: tokens.color.semantic.warn,
  block: tokens.color.semantic.block,
  info: tokens.color.semantic.info,
};

function semanticBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

export function Flag({ severity, label }: FlagProps) {
  const color = severityColorMap[severity];

  return (
    <View style={[styles.pill, { backgroundColor: semanticBg(color) }]}>
      <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[1],
  },
  label: {
    ...tokens.type.micro,
    fontFamily: tokens.font.body,
  },
});
