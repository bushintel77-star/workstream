import cp from "./confirm-pin.module.css";

export default function ConfirmPinLoading() {
  return (
    <div
      className={cp.stage}
      aria-busy="true"
      aria-label="Locating property"
    >
      <div className={cp.bleed} aria-hidden />
      <header className={cp.chrome}>
        <div className={cp.chromeBrand}>
          <span className={cp.brandMark}>Workstream</span>
          <span className={cp.status}>Locating your property…</span>
        </div>
      </header>
    </div>
  );
}
