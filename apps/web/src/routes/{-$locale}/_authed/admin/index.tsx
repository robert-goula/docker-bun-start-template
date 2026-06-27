import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_authed/admin/")({
  component: Page,
});

function Page() {
  return (
    <p>Admin…</p>
  );
}
