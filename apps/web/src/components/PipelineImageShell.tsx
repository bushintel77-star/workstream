import sh from "./pipelineImageShell.module.css";

type Props = {
  testId?: string;
  canvasCol: React.ReactNode;
  rail: React.ReactNode;
  canvasColClassName?: string;
};

/** Image-first shell — aerial column + scrollable side rail (studio + pipeline hub). */
export function PipelineImageShell({
  testId,
  canvasCol,
  rail,
  canvasColClassName,
}: Props) {
  return (
    <div className={sh.imageShell} data-testid={testId}>
      <div className={sh.workspace}>
        <div className={`${sh.canvasCol} ${canvasColClassName ?? ""}`.trim()}>
          {canvasCol}
        </div>
        <aside className={sh.sideRail}>{rail}</aside>
      </div>
    </div>
  );
}

export { sh as pipelineImageShellStyles };
