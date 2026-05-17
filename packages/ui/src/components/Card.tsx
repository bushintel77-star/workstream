import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '../tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.surface.elevated,
    borderRadius: tokens.radius.lg,
    padding: tokens.space[5],
    ...tokens.elevation[1],
  },
});
