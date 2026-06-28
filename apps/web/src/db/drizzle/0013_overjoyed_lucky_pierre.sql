ALTER TABLE "page" ADD COLUMN "system" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Existing admin pages become route-owned "system" pages.
UPDATE "page" SET "system" = true WHERE "slug" LIKE '/admin/%';
--> statement-breakpoint
-- Unify each admin slug's per-locale rows onto the en-us (default-locale) row's groupId so
-- menus translate the linked label and the locales are one translation group again. Existing
-- admin-nav menu links were built in en-us, so keeping that groupId preserves them.
UPDATE "page" AS p
SET "groupId" = canonical."groupId"
FROM (
  SELECT "slug", "groupId" FROM "page" WHERE "locale" = 'en-us' AND "slug" LIKE '/admin/%'
) AS canonical
WHERE p."slug" = canonical."slug" AND p."slug" LIKE '/admin/%';