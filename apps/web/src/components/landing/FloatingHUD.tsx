import type { HTMLAttributes, ReactNode } from "react";
import css from "./floatingHud.module.css";

type FloatingHUDTone = "default" | "gold" | "blue";
type FloatingHUDPadding = "sm" | "md" | "lg";
type FloatingHUDTag = "div" | "section" | "aside";

type FloatingHUDProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: FloatingHUDTag;
  children: ReactNode;
  className?: string;
  padding?: FloatingHUDPadding;
  tone?: FloatingHUDTone;
};

const toneClassMap: Record<FloatingHUDTone, string> = {
  default: css.toneDefault,
  gold: css.toneGold,
  blue: css.toneBlue,
};

const paddingClassMap: Record<FloatingHUDPadding, string> = {
  sm: css.padSm,
  md: css.padMd,
  lg: css.padLg,
};

export function FloatingHUD({
  as,
  children,
  className,
  padding = "md",
  tone = "default",
  ...rest
}: FloatingHUDProps) {
  const Component = as ?? "section";

  return (
    <Component
      {...rest}
      className={[
        css.hud,
        toneClassMap[tone],
        paddingClassMap[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Component>
  );
}
