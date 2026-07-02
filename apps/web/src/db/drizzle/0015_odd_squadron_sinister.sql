ALTER TABLE "tenant" DROP CONSTRAINT "tenant_name_idx";--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "deleted" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "deletedBy" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_name_active_idx" ON "tenant" USING btree ("name") WHERE "tenant"."deleted" is null;