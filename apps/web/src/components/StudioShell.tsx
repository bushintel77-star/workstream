import { OperatorNav } from "./OperatorNav";

export function StudioShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OperatorNav />
      {children}
    </>
  );
}
