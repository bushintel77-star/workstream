import s from "./ui.module.css";

type Size = "sm" | "md" | "lg" | "full";

type Props = {
  size?: Size;
  radius?: number;
  className?: string;
};

export function Skeleton({ size = "md", radius, className }: Props) {
  return (
    <div
      className={`${s.skeleton} ${s[`skel_${size}`] ?? ""} ${className ?? ""}`}
      style={radius != null ? { borderRadius: radius } : undefined}
      aria-hidden
    />
  );
}

export function SkeletonRow({ count = 3 }: { count?: number }) {
  return (
    <div className={s.skeletonRow} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} size="full" className={s.skeletonCard} />
      ))}
    </div>
  );
}
