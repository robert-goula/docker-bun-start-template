import { Context } from "effect";
import type { TenantId } from "@/db/schema/tenants";
import type { UserId } from "@/db/schema/users";

export interface SessionUser {
  readonly id: UserId;
  readonly email: string;
  readonly roles: ReadonlyArray<string>;
  readonly passwordRehashedAt: Date | null;
  readonly tenantId: TenantId | null;
  readonly availableTenants: ReadonlyArray<TenantId>;
}

export class CurrentUser extends Context.Tag("app/CurrentUser")<CurrentUser, SessionUser>() {}
