import type { CSSProperties, ReactNode } from "react";
import css from "./metaChip.module.css";

type MetaChipTone = "gold" | "blue" | "normal" | "dimmed";

type MetaChipProps = {
  icon?: ReactNode;
  label: string;
  value?: string;
  tone?: MetaChipTone;
  revealDelayMs?: number;
};

const toneClassMap: Record<MetaChipTone, string> = {
  gold: css.toneGold,
  blue: css.toneBlue,
  normal: css.toneNormal,
  dimmed: css.toneDimmed,
};

export function MetaChip({
  icon,
  label,
  value,
  tone = "gold",
  revealDelayMs = 0,
}: MetaChipProps) {
  const style = {
    "--reveal-delay": `${revealDelayMs}ms`,
  } as CSSProperties;

  return (
    <div className={[css.chip, toneClassMap[tone]].join(" ")} style={style}>
      {icon ? (
        <span className={css.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={css.label}>{label}</span>
      {value ? <strong className={css.value}>{value}</strong> : null}
    </div>
  );
}
