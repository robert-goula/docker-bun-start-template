import { Outlet, createFileRoute } from "@tanstack/react-router";

// Locale layout. The `{-$locale}` optional param gives URL shape and typed-link
// ergonomics; it is intentionally NOT the source of truth for "is this a locale" —
// the root resolver (src/lib/locale.ts, via context.i18n) decides that. So there is
// no param-based validation/redirect here; this layout just renders its children.
export const Route = createFileRoute("/{-$locale}")({
  component: Page,
});

function Page() {
  return (
    <Outlet />
  )
}
