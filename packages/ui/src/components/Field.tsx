import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { tokens } from '../tokens';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  autoCapitalize,
}: FieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? tokens.color.semantic.block
    : focused
      ? tokens.color.accent.default
      : tokens.color.line.hairline;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        style={[styles.input, { borderBottomColor: borderColor }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.ink.tertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space[1],
  },
  label: {
    ...tokens.type.micro,
    color: tokens.color.ink.tertiary,
    fontFamily: tokens.font.body,
  },
  input: {
    ...tokens.type.body,
    color: tokens.color.ink.primary,
    fontFamily: tokens.font.body,
    backgroundColor: tokens.color.surface.sunken,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.space[3],
    borderBottomWidth: 2,
    borderBottomColor: tokens.color.line.hairline,
  },
  error: {
    ...tokens.type.caption,
    color: tokens.color.semantic.block,
    fontFamily: tokens.font.body,
  },
});
