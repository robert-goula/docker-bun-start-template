import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import styles from "./admin.module.css";

export const Route = createFileRoute("/_authed/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <>
      <nav className={styles.nav}>
        <Link
          to="/admin"
          className="nav-link"
          activeOptions={{ exact: true }}
          activeProps={{ className: "nav-link is-active" }}
        >
          Admin
        </Link>
        <Link to="/admin/users" activeProps={{ className: "nav-link is-active" }}>
          Users
        </Link>
        <Link to="/admin/pages" activeProps={{ className: "nav-link is-active" }}>
          Pages
        </Link>
        <Link to="/admin/layouts" activeProps={{ className: "nav-link is-active" }}>
          Layouts
        </Link>
        <Link to="/admin/custom-widgets" activeProps={{ className: "nav-link is-active" }}>
          Custom widgets
        </Link>
        <Link to="/admin/menus" activeProps={{ className: "nav-link is-active" }}>
          Menus
        </Link>
        <Link to="/admin/zones" activeProps={{ className: "nav-link is-active" }}>
          Zones
        </Link>
      </nav>
      <Outlet />
    </>
  );
}
