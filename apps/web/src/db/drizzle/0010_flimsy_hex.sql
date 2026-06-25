ALTER TABLE "menu" ADD COLUMN "orientation" varchar(16) DEFAULT 'vertical' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "submenuMode" varchar(16) DEFAULT 'expanded' NOT NULL;