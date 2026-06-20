ALTER TABLE "widget" ADD COLUMN "content" jsonb;
--> statement-breakpoint
-- Backfill: move markdown content out of `options.content` into the new `content`
-- column (a bare JSON string scalar) and strip the key from `options`.
UPDATE "widget"
   SET "content" = "options" -> 'content',
       "options" = "options" - 'content'
 WHERE "kind" = 'markdown' AND "options" ? 'content';
