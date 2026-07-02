CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(80) NOT NULL,
	"created" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdBy" uuid,
	"updated" timestamp (3) with time zone,
	"updatedBy" uuid,
	CONSTRAINT "tenant_name_idx" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tenantId" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "availableTenants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_tenantId_tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;