import { StudioShell } from "../../components/StudioShell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudioShell>{children}</StudioShell>;
}
