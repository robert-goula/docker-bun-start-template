-- Backfill: fold the dedicated size column into options.size before dropping it.
UPDATE "widget"
   SET "options" = "options" || jsonb_build_object('size', "size")
 WHERE "size" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "widget" DROP COLUMN "size";
