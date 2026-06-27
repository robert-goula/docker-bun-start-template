CREATE TABLE "taxonomy" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"parentId" uuid,
	"value" varchar(255) NOT NULL,
	"locales" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid
);
--> statement-breakpoint
ALTER TABLE "taxonomy" ADD CONSTRAINT "taxonomy_parentId_taxonomy_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."taxonomy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "taxonomy_parentId_sort_idx" ON "taxonomy" USING btree ("parentId","sort");