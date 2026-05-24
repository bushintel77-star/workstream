import "./portal.css";

export const runtime = "edge";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="portal-root">{children}</div>;
}
