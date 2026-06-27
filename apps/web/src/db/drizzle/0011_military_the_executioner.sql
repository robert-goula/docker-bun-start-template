CREATE TABLE "config" (
	"id" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" varchar(300),
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid
);
