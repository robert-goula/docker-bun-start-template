CREATE TABLE "layoutZone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"layoutId" uuid NOT NULL,
	"zoneId" uuid NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "layoutZone_layoutId_zoneId_idx" UNIQUE("layoutId","zoneId")
);
--> statement-breakpoint
CREATE TABLE "layout" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(500),
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "layout_name_idx" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"locale" varchar(10) DEFAULT 'en-us' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" varchar(500),
	"layoutId" uuid NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "page_slug_locale_idx" UNIQUE("slug","locale")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"username" varchar(40) NOT NULL,
	"password" varchar(255),
	"firstName" varchar(20),
	"lastName" varchar(20),
	"email" varchar(255) NOT NULL,
	"roles" text[] DEFAULT ARRAY['user']::text[] NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	"locked" boolean DEFAULT false,
	"lockedBy" uuid,
	"passwordRehashedAt" timestamp (3) with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_idx" UNIQUE("username"),
	CONSTRAINT "user_email_idx" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "widget" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"pageId" uuid NOT NULL,
	"zoneId" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"size" varchar(10),
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(40) NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "zone_name_idx" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "layoutZone" ADD CONSTRAINT "layoutZone_layoutId_layout_id_fk" FOREIGN KEY ("layoutId") REFERENCES "public"."layout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layoutZone" ADD CONSTRAINT "layoutZone_zoneId_zone_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_layoutId_layout_id_fk" FOREIGN KEY ("layoutId") REFERENCES "public"."layout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget" ADD CONSTRAINT "widget_pageId_page_id_fk" FOREIGN KEY ("pageId") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget" ADD CONSTRAINT "widget_zoneId_zone_id_fk" FOREIGN KEY ("zoneId") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "layoutZone_layoutId_idx" ON "layoutZone" USING btree ("layoutId");--> statement-breakpoint
CREATE INDEX "widget_pageId_idx" ON "widget" USING btree ("pageId");--> statement-breakpoint
CREATE INDEX "widget_zoneId_idx" ON "widget" USING btree ("zoneId");