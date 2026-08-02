"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import s from "./kit.module.css";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "md";
};

/**
 * shadcn/ui-style Input. Clean border, focus ring, subtle inset shadow.
 */
export const KitInput = forwardRef<HTMLInputElement, InputProps>(
  function KitInput({ size = "md", className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        data-size={size}
        className={`${s.input} ${className ?? ""}`.trim()}
        {...rest}
      />
    );
  },
);

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: "sm" | "md";
};

/**
 * shadcn/ui-style Textarea. Matches KitInput styling.
 */
export const KitTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function KitTextarea({ size = "md", className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        data-size={size}
        className={`${s.textarea} ${className ?? ""}`.trim()}
        {...rest}
      />
    );
  },
);
