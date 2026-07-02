import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useIntlayer } from "react-intlayer";
import { Button } from "@/components/ui/button";
import { logoutFn, meQueryOptions } from "@/server/fns/auth";
import ThemeToggle from "./ThemeToggle";
import FontSizeControls from "./FontSizeControls";
import AccentControls from "./AccentControls";
import LanguageSwitcher from "./LanguageSwitcher";
import TenantSwitcher from "./TenantSwitcher";
import { EditModeToggle } from "./EditMode";
import { cx } from "class-variance-authority";
import styles from "./Header.module.css";

export default function Header() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSuspenseQuery(meQueryOptions());
  const content = useIntlayer("header");

  const logout = useMutation({
    mutationFn: () => logoutFn(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.navigate({ to: "/{-$locale}/login" });
    },
  });

  return (
    <header>
      <section className="⅓">
        <h2>
          <Link to="/{-$locale}">{content.home}</Link>
        </h2>
      </section>

      <section className="⅓">
        <nav className="full">
          <Link
            to="/{-$locale}"
            className="nav-link"
            activeProps={{ className: "nav-link is-active" }}
          >
            {content.home}
          </Link>
          {me.data?.roles.includes("admin") && (
            <>
              <Link
                to="/{-$locale}/admin"
                className="nav-link"
                activeProps={{ className: "nav-link is-active" }}
              >
                {content.admin}
              </Link>
            </>
          )}
        </nav>
      </section>
      <section className={cx(styles.rhs, "⅓")}>
        <TenantSwitcher />
        <LanguageSwitcher />
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
              {logout.isPending ? content.signingOut : content.signOut}
            </Button>
          </div>
        ) : (
          <Link to="/{-$locale}/login" className="nav-link">
            {content.signIn}
          </Link>
        )}
      </section>
    </header>
  );
}
