import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <>
      {/* Legacy admin menu. Kept above the page-builder chrome during the transition to
          a CMS-driven admin nav (the embedded CmsPage nav zone), which will replace this. */}
      <nav id="admin-menu">
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
