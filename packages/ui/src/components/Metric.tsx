import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../tokens';

interface MetricProps {
  label: string;
  value: string;
  unit?: string;
}

export function Metric({ label, value, unit }: MetricProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space[1],
  },
  label: {
    ...tokens.type.micro,
    color: tokens.color.ink.secondary,
    fontFamily: tokens.font.body,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.space[1],
  },
  value: {
    ...tokens.type.displayM,
    color: tokens.color.ink.primary,
    fontFamily: tokens.font.mono,
  },
  unit: {
    ...tokens.type.caption,
    color: tokens.color.ink.secondary,
    fontFamily: tokens.font.mono,
  },
});
