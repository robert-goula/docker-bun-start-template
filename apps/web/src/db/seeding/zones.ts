import type { CreateZone } from "@/db/schema/zones";
import { ZONE_NAMES } from "@/db/schema/zones";

// Fixed catalog of placement zones. Let the DB generate `id` (uuidv7()) and
// `created` (defaultNow()); only the canonical `name` is needed here.
export const zones: Array<CreateZone> = ZONE_NAMES.map((name) => ({ name }));
