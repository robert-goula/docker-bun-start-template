import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useIntlayer } from "react-intlayer";
import { Menu } from "@base-ui/react";
import { ChevronDownIcon } from "lucide-react";
import type { TenantId } from "@/db/schema/tenants";
import {
  availableTenantsQueryOptions,
  meQueryOptions,
  switchTenantFn,
} from "@/server/fns/auth";
import styles from "./TenantSwitcher.module.css";

/**
 * Switches the user's active tenant. Lists the tenants in the session's
 * availableTenants and calls switchTenantFn; on success it refetches the session so
 * the active tenant updates everywhere. Renders nothing unless the user has more than
 * one available tenant.
 */
export default function TenantSwitcher() {
  const content = useIntlayer("tenantSwitcher");
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSuspenseQuery(meQueryOptions());
  const availableTenants = me.data?.availableTenants ?? [];
  const hasMultiple = availableTenants.length > 1;
  const tenants = useQuery({ ...availableTenantsQueryOptions(), enabled: hasMultiple });

  const switchTenant = useMutation({
    mutationFn: (tenantId: TenantId) => switchTenantFn({ data: { tenantId } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await router.invalidate();
    },
  });

  if (!hasMultiple) return null;

  const activeId = me.data?.tenantId ?? null;
  const items = tenants.data ?? [];
  const activeName = items.find((t) => t.id === activeId)?.name ?? content.placeholder.value;

  return (
    <Menu.Root>
      <Menu.Trigger
        className={styles.trigger}
        aria-label={content.label.value}
        disabled={switchTenant.isPending}
      >
        <span>{activeName}</span>
        <ChevronDownIcon className={styles.icon} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={6} align="end">
          <Menu.Popup className={styles.popup}>
            {items.map((tenant) => (
              <Menu.Item
                key={tenant.id}
                className={styles.item}
                disabled={tenant.id === activeId || switchTenant.isPending}
                onClick={() => switchTenant.mutate(tenant.id as TenantId)}
              >
                {tenant.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
