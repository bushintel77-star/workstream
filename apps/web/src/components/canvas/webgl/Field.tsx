"use client";

/**
 * Gold Standard 2026 — Tier 3 primitive extraction: <Input>, <Select>, <Field>.
 *
 * Binding: docs/UI-ELEMENT-STANDARDS.md §6 (pending primitives) and §7
 * (Tier 3 — structure changes: extract primitives). The audit found
 * 23 raw `<input>` across 6 files and 4 raw `<select>` in
 * InspectorCard.tsx; this primitive is the first consumer (InspectorCard)
 * and the design target for every future call site.
 *
 * Pixel-stable: the visual output matches the prior inline `<input>` /
 * `<select>` styles in InspectorCard.tsx exactly — same padding
 * (`4px 6px`), same `fontSize: var(--gs-font-lg)`, same hairline +
 * `--gs-line` border, same `var(--gs-radius-chip)` corner, same
 * commit-on-blur / commit-on-change semantics. Consumers that pass
 * `style` get a merge where the consumer's overrides win on individual
 * properties — never silently overridden.
 *
 * The primitives forward every standard HTMLInputElement /
 * HTMLSelectElement prop (size, min, max, step, disabled, etc.) so
 * call sites don't lose expression.
 */

import type {
  ChangeEventHandler,
  ComponentProps,
  CSSProperties,
  FocusEventHandler,
  KeyboardEventHandler,
  ReactNode,
} from "react";
import { forwardRef } from "react";

/**
 * Shared chrome-tier input shell — consumes the same scale tokens as
 * InspectorCard's prior inline `inputCss`. Pulled out so every input
 * site in canvas chrome converges on one rendering.
 */
const baseInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-lg)",
  padding: "4px 6px",
  borderRadius: "var(--gs-radius-chip)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 60%, transparent)",
  background: "transparent",
  color: "var(--gs-ink)",
};

export interface FieldProps {
  /** Field label rendered in the upper-case scale-tiny style. */
  labelText: string;
  /** Optional hint rendered below the input. */
  hint?: ReactNode;
  /** Field child (typically an <Input> or <Select>). */
  children?: ReactNode;
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--gs-ink-secondary)",
  marginBottom: 2,
};

const fieldHintStyle: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  color: "var(--gs-ink-muted)",
  marginTop: 2,
};

const fieldRowStyle: CSSProperties = { marginBottom: 6 };

/**
 * <Field> — label + control + optional hint. The chrome-tier row
 * scaffold every InspectorCard field uses. Kept in this file because
 * <Field>, <Input>, and <Select> are always rendered together; one
 * import beats three.
 */
export function Field({ labelText, hint, children }: FieldProps) {
  return (
    <div style={fieldRowStyle}>
      <span style={fieldLabelStyle}>{labelText}</span>
      {children}
      {hint ? <span style={fieldHintStyle}>{hint}</span> : null}
    </div>
  );
}

/**
 * Common shape — extends standard HTML element props but accepts any
 * `data-*` attribute, since `@types/react@19` no longer widens them
 * through `HTMLAttributes`. Tests + InspectorCard rely on `data-testid`.
 */
type ChromeInputAttr<T extends "input" | "select" | "textarea"> = Omit<
  ComponentProps<T>,
  "onChange" | "onBlur"
> & {
  [key: `data-${string}`]: string | undefined;
};

export type InputProps = ChromeInputAttr<"input"> & {
  /** Stable React `key` for the field. InspectorCard uses `key` to
   *  force-remount each input when its row's selected entity changes. */
  key?: string | number | null;
  /** Forwarded to the underlying `<input>`. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Forwarded to the underlying `<input>`. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Forwarded to the underlying `<input>`. */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Optional style override; merged over the chrome-tier shell. */
  style?: CSSProperties;
};

/**
 * <Input> — chrome-tier text/number input. Pixel-stable replacement
 * for every raw `<input>` in canvas chrome. Defaults the underlying
 * element to `type="text"` (matches InspectorCard's most-common usage).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { style, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      style={{ ...baseInputStyle, ...style }}
    />
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectProps = Omit<ChromeInputAttr<"select">, "onChange"> & {
  /** Forwarded to the underlying `<select>`. */
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  /** Style override; merged over the chrome-tier shell. */
  style?: CSSProperties;
};

/**
 * <Select> — chrome-tier native `<select>`. Pixel-stable replacement
 * for InspectorCard's labor-tier `<select>`. Inherits the Input shell
 * so a `<Field>` with `<Select>` reads the same as a `<Field>` with
 * `<Input>`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, style, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      {...rest}
      style={{ ...baseInputStyle, ...style }}
    >
      {children}
    </select>
  );
});