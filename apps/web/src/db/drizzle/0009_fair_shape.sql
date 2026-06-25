CREATE TABLE "layoutWidget" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"layoutId" uuid NOT NULL,
	"locale" varchar(10),
	"zoneId" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid
);
--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "hiddenLayoutWidgets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "layoutWidget" ADD CONSTRAINT "layoutWidget_layoutId_layout_id_fk" FOREIGN KEY ("layoutId") REFERENCES "public"."layout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layoutWidget" ADD CONSTRAINT "layoutWidget_zoneId_zone_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "layoutWidget_layoutId_locale_idx" ON "layoutWidget" USING btree ("layoutId","locale");--> statement-breakpoint
CREATE INDEX "layoutWidget_zoneId_idx" ON "layoutWidget" USING btree ("zoneId");