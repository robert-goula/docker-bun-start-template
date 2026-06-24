CREATE TABLE "menu" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"description" varchar(500),
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "menu_name_idx" UNIQUE("name"),
	CONSTRAINT "menu_slug_idx" UNIQUE("slug")
);
