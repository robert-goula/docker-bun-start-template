CREATE TABLE "custom_widget" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"template" varchar(40),
	"description" varchar(500),
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "custom_widget_name_idx" UNIQUE("name"),
	CONSTRAINT "custom_widget_slug_idx" UNIQUE("slug")
);
