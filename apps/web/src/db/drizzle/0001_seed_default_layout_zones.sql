-- Custom SQL migration file, put your code below! --

-- Seed the fixed zone catalog. Ids/timestamps use the table defaults (uuidv7(), now()).
INSERT INTO "zone" ("name")
VALUES ('hero'), ('main'), ('sidebar'), ('footer')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

-- Seed the `default` layout that every new page is linked to
-- (see PageRepo.resolveDefaultLayoutId). Without it, every page load fails.
INSERT INTO "layout" ("name", "description")
VALUES ('default', 'Default layout seeded for new pages.')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

-- Link the default layout to every catalog zone, using the canonical arrangement
-- (kept in sync with DEFAULT_ZONE_ARRANGEMENT in src/db/schema/layoutZones.ts).
INSERT INTO "layoutZone" ("layoutId", "zoneId", "options")
SELECT
  l.id,
  z.id,
  jsonb_build_object(
    'title', initcap(z.name),
    'size', CASE z.name
      WHEN 'hero' THEN 'full'
      WHEN 'main' THEN '⅔'
      WHEN 'sidebar' THEN '⅓'
      WHEN 'footer' THEN 'full'
      ELSE 'full'
    END,
    'order', CASE z.name
      WHEN 'hero' THEN 0
      WHEN 'main' THEN 1
      WHEN 'sidebar' THEN 2
      WHEN 'footer' THEN 3
      ELSE 0
    END,
    'defaultOpen', true
  )
FROM "layout" l
CROSS JOIN "zone" z
WHERE l.name = 'default'
ON CONFLICT ("layoutId", "zoneId") DO NOTHING;
