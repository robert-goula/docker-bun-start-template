import type { CreateLayout } from "@/db/schema/layouts";
import { DEFAULT_LAYOUT_NAME } from "@/db/schema/layouts";

// The `default` layout every new page is linked to (see PageRepo.resolveDefaultLayoutId).
// Its per-zone arrangement is seeded separately from DEFAULT_ZONE_ARRANGEMENT.
export const layouts: Array<CreateLayout> = [
  { name: DEFAULT_LAYOUT_NAME, description: "Default layout seeded for new pages." },
];
