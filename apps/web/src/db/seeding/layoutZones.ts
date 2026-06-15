import { DEFAULT_LAYOUT_NAME } from "@/db/schema/layouts";
import type { LayoutZoneOptions } from "@/db/schema/layoutZones";
import { DEFAULT_ZONE_ARRANGEMENT } from "@/db/schema/layoutZones";
import { type ZoneName, ZONE_NAMES } from "@/db/schema/zones";

// layoutZone rows reference DB-generated layout/zone ids, so the seed declares them by
// name; the seed script resolves names → ids at runtime. The `default` layout gets one
// entry per catalog zone, using the canonical DEFAULT_ZONE_ARRANGEMENT.
export type LayoutZoneSeed = {
  layout: string;
  zone: ZoneName;
  options: LayoutZoneOptions;
};

export const layoutZones: Array<LayoutZoneSeed> = ZONE_NAMES.map((name) => ({
  layout: DEFAULT_LAYOUT_NAME,
  zone: name,
  options: DEFAULT_ZONE_ARRANGEMENT[name],
}));
