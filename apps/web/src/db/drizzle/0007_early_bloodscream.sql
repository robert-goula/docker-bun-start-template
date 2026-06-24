ALTER TABLE "page" ADD COLUMN "group_id" uuid DEFAULT uuidv7() NOT NULL;--> statement-breakpoint
-- Backfill: before this migration translations were linked by a shared slug. Collapse each
-- slug's rows onto a single group_id (the lowest-locale row's) so existing translations stay
-- grouped now that the slug is per-locale. New rows get their own group via the column default.
UPDATE "page" AS p
SET "group_id" = g."group_id"
FROM (
  SELECT DISTINCT ON ("slug") "slug", "group_id"
  FROM "page"
  ORDER BY "slug", "locale"
) AS g
WHERE p."slug" = g."slug";--> statement-breakpoint
CREATE INDEX "page_group_id_idx" ON "page" USING btree ("group_id");
