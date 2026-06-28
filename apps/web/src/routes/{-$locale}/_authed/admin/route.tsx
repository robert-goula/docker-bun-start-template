import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
      <Outlet />
  );
}
