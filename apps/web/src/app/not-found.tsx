import { NotFoundView } from "../components/NotFoundView";

export default function NotFound() {
  return (
    <NotFoundView
      title="Page not found"
      message="That page doesn't exist or may have moved. Head back to your projects."
    />
  );
}
