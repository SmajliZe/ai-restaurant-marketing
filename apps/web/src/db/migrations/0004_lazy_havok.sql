CREATE TABLE "menu_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"overview" text NOT NULL,
	"pricing_notes" text NOT NULL,
	"description_quality" text NOT NULL,
	"upselling_ideas" jsonb NOT NULL,
	"cross_selling_ideas" jsonb NOT NULL,
	"missing_items" jsonb NOT NULL,
	"improvement_suggestions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_analyses" ADD CONSTRAINT "menu_analyses_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;