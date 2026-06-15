export type ZoneSize = "full" | "½" | "⅓" | "⅔" | "¼" | "¾";

export const zoneSizeOptions: { label: string; value: ZoneSize }[] = [
  { label: "Full", value: "full" },
  { label: "3/4", value: "¾" },
  { label: "2/3", value: "⅔" },
  { label: "1/2", value: "½" },
  { label: "1/3", value: "⅓" },
  { label: "1/4", value: "¼" },
];
