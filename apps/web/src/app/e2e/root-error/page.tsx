/** E2E-only route — triggers the app-level error boundary in non-production. */
export default function E2eRootErrorPage() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  throw new Error("E2E root error boundary probe");
}
