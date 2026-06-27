import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <>
      <nav id="top">
        <Link to="/{-$locale}/admin">
          Admin
        </Link>
        <Link to="/{-$locale}/admin/users">
          Users
        </Link>
        <Link to="/{-$locale}/admin/pages">
          Pages
        </Link>
        <Link to="/{-$locale}/admin/layouts">
          Layouts
        </Link>
        <Link to="/{-$locale}/admin/custom-widgets">
          Custom widgets
        </Link>
        <Link to="/{-$locale}/admin/menus">
          Menus
        </Link>
        <Link to="/{-$locale}/admin/taxonomy">
          Taxonomy
        </Link>
        <Link to="/{-$locale}/admin/zones">
          Zones
        </Link>
        <Link to="/{-$locale}/admin/config">
          Config
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}
