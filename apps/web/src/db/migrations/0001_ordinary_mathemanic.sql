CREATE TYPE "public"."sticker_type" AS ENUM('poll', 'question', 'emoji_slider', 'countdown');--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"recognized_dish" text NOT NULL,
	"confidence" real NOT NULL,
	"instagram_caption" text NOT NULL,
	"instagram_hashtags" jsonb NOT NULL,
	"facebook_post" text NOT NULL,
	"facebook_hashtags" jsonb NOT NULL,
	"story_text" text NOT NULL,
	"story_cta" text NOT NULL,
	"story_sticker_type" "sticker_type" NOT NULL,
	"story_sticker_prompt" text NOT NULL,
	"enhanced_image_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_content" ADD CONSTRAINT "generated_content_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;