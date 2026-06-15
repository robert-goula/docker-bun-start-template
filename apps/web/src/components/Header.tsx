import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { logoutFn, meQueryOptions } from "@/server/fns/auth";
import ThemeToggle from "./ThemeToggle";
import FontSizeControls from "./FontSizeControls";
import AccentControls from "./AccentControls";
import { EditModeToggle } from "./EditMode";
import { cx } from "class-variance-authority";
import styles from "./Header.module.css";

export default function Header() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSuspenseQuery(meQueryOptions());

  const logout = useMutation({
    mutationFn: () => logoutFn(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.navigate({ to: "/login" });
    },
  });

  return (
    <header>
      <section className="⅓">
        <h2>
          <Link to="/">Home</Link>
        </h2>
      </section>

      <section className="⅓">
        <nav className="full">
          <Link to="/" className="nav-link" activeProps={{ className: "nav-link is-active" }}>
            Home
          </Link>
          {me.data?.roles.includes("admin") && (
            <>
              <Link
                to="/admin"
                className="nav-link"
                activeProps={{ className: "nav-link is-active" }}
              >
                Admin
              </Link>
            </>
          )}
        </nav>
      </section>
      <section className={cx(styles.rhs, "⅓")}>
        <FontSizeControls />
        <AccentControls />
        <ThemeToggle />
        <EditModeToggle />
        {me.data ? (
          <div>
            <span className="text-xs text-muted-foreground">{me.data.email}</span>{" "}
            <Button
              size="xs"
              variant="outline"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        ) : (
          <Link to="/login" className="nav-link">
            Sign in
          </Link>
        )}
      </section>
    </header>
  );
}
