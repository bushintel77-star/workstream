import styles from "./spinner.module.css";

type Size = "sm" | "md" | "lg";

export function Spinner({
  size = "sm",
  className,
  label = "Loading",
}: {
  size?: Size;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={[styles.spinner, styles[size], styles.inline, className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={label}
    />
  );
}
