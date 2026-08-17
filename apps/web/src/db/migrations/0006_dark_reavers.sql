CREATE TABLE "style_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"profile_count" integer NOT NULL,
	"visual_style_notes" text NOT NULL,
	"content_style_notes" text NOT NULL,
	"content_pillars" jsonb NOT NULL,
	"recommendations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_analyses" ADD CONSTRAINT "style_analyses_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;