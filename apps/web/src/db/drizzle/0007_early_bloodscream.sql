ALTER TABLE "page" ADD COLUMN "groupId" uuid DEFAULT uuidv7() NOT NULL;--> statement-breakpoint
-- Backfill: before this migration translations were linked by a shared slug. Collapse each
-- slug's rows onto a single groupId (the lowest-locale row's) so existing translations stay
-- grouped now that the slug is per-locale. New rows get their own group via the column default.
UPDATE "page" AS p
SET "groupId" = g."groupId"
FROM (
  SELECT DISTINCT ON ("slug") "slug", "groupId"
  FROM "page"
  ORDER BY "slug", "locale"
) AS g
WHERE p."slug" = g."slug";--> statement-breakpoint
CREATE INDEX "page_groupId_idx" ON "page" USING btree ("groupId");
