import { NotFoundView } from "../../../components/NotFoundView";

export type { ProjectTab } from "../../../lib/project-tabs";
export { getProjectTabs } from "../../../lib/project-tabs";

export function NotFoundPage({ message }: { message: string }) {
  return <NotFoundView title="Project not found" message={message} />;
}
