import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <>
      <nav id="top">
        <Link to="/admin">
          Admin
        </Link>
        <Link to="/admin/users">
          Users
        </Link>
        <Link to="/admin/pages">
          Pages
        </Link>
        <Link to="/admin/layouts">
          Layouts
        </Link>
        <Link to="/admin/custom-widgets">
          Custom widgets
        </Link>
        <Link to="/admin/menus">
          Menus
        </Link>
        <Link to="/admin/zones">
          Zones
        </Link>
        <Link to="/admin/config">
          Config
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}
