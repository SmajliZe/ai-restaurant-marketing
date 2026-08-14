CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"occasion" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"offer" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" jsonb NOT NULL,
	"story_text" text NOT NULL,
	"story_cta" text NOT NULL,
	"story_sticker_type" "sticker_type" NOT NULL,
	"story_sticker_prompt" text NOT NULL,
	"cta" text NOT NULL,
	"duration_suggestion" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;