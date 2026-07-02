import type { CreateTenant } from "@/db/schema/tenants";

// Fixed seed ids so the user seed can reference them deterministically.
export const ADMIN_TENANT_ID = "0194c210-0000-7000-8000-000000000001";
export const TEST_TENANT_ID = "0194c210-0000-7000-8000-000000000002";

export const tenants: Array<CreateTenant> = [
  {
    id: ADMIN_TENANT_ID,
    name: "admin",
    created: new Date("2021-09-01T00:00:00.000Z"),
    createdBy: "00000000-0000-0000-0000-000000000000",
    updated: null,
    updatedBy: null,
  },
  {
    id: TEST_TENANT_ID,
    name: "test",
    created: new Date("2021-09-01T00:00:00.000Z"),
    createdBy: "00000000-0000-0000-0000-000000000000",
    updated: null,
    updatedBy: null,
  },
];
