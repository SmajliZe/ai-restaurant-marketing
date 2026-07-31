CREATE TYPE "public"."tone_of_voice" AS ENUM('friendly', 'luxury', 'modern', 'family', 'premium', 'minimalistic', 'humorous');--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"country" text NOT NULL,
	"language" text NOT NULL,
	"cuisine_type" text NOT NULL,
	"tone_of_voice" "tone_of_voice" NOT NULL,
	"logo_url" text,
	"description" text,
	"opening_hours" jsonb,
	"website" text,
	"phone" text,
	"email" text,
	"instagram_handle" text,
	"facebook_handle" text,
	"tiktok_handle" text,
	"brand_colors" jsonb,
	"target_audience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;