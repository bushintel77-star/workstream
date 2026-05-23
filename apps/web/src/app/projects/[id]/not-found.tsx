import { NotFoundView } from "../../../components/NotFoundView";

export default function ProjectNotFound() {
  return (
    <NotFoundView
      title="Project not found"
      message="That project couldn't be loaded — it may have been deleted or the API just restarted."
    />
  );
}
