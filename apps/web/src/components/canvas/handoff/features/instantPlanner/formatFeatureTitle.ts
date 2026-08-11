/** Convert persisted shorthand labels into operator-facing feature names. */
export function formatFeatureTitle(label: string): string {
  const dbh = /^exist:dbh=([\d.]+)$/.exec(label);
  if (dbh) return `Existing Tree — DBH ${Number(dbh[1]).toFixed(2)} m`;

  const stems = /^exist:stems=([\d.,]+)$/.exec(label);
  if (stems) {
    const values = stems[1]!
      .split(",")
      .map((value) => Number(value))
      .filter(Number.isFinite);
    if (values.length > 0) {
      return `Existing Tree — ${values.length} stems · DBH ${values
        .map((value) => `${value.toFixed(2)} m`)
        .join(" / ")}`;
    }
  }

  return label
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Feature";
}
