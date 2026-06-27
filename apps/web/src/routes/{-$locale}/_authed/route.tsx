import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/server/fns/auth";

// Auth gate for everything under `_authed`. `meFn` returns null (rather than throwing)
// when there is no valid session, so checking it here lets us redirect to the login
// page instead of letting a child route's data loader hit the auth-guarded server fn
// and throw a 401 Response — which SSR can't serialize. `next` carries the originally
// requested URL so login can return the user to it. The locale param is inherited, so
// the login target stays on the same locale (e.g. /es-us/login).
export const Route = createFileRoute("/{-$locale}/_authed")({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (!me) {
      throw redirect({ to: "/{-$locale}/login", search: { next: location.href } });
    }
  },
  component: () => <Outlet />,
});
