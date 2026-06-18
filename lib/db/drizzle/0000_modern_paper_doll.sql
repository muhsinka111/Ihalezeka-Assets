CREATE TABLE "tenders" (
	"id" serial PRIMARY KEY NOT NULL,
	"ikn" text NOT NULL,
	"title" text NOT NULL,
	"agency_name" text NOT NULL,
	"agency_logo_url" text,
	"type" text NOT NULL,
	"method" text NOT NULL,
	"estimated_value" real,
	"deadline" timestamp with time zone,
	"cpv_codes" text[] DEFAULT '{}' NOT NULL,
	"il" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"category" text DEFAULT 'ihale' NOT NULL,
	"description" text,
	"qualification_criteria" text[] DEFAULT '{}' NOT NULL,
	"documents_required" text[] DEFAULT '{}' NOT NULL,
	"raw_docs_urls" text[] DEFAULT '{}' NOT NULL,
	"source_system" text DEFAULT 'ekap' NOT NULL,
	"source_url" text,
	"procurement_method" text,
	"documents" jsonb,
	"contact" jsonb,
	"raw_data" jsonb,
	"ai_summary" jsonb,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenders_ikn_unique" UNIQUE("ikn")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"tender_id" integer NOT NULL,
	"fit_score" integer DEFAULT 0 NOT NULL,
	"reasoning" text,
	"pros" text[] DEFAULT '{}' NOT NULL,
	"risks" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"tender_id" integer NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"company_name" text NOT NULL,
	"tax_number" text NOT NULL,
	"mersis_number" text,
	"ekap_number" text,
	"nace_codes" text[] DEFAULT '{}' NOT NULL,
	"cpv_codes" text[] DEFAULT '{}' NOT NULL,
	"experience_ceiling" real,
	"certifications" text[] DEFAULT '{}' NOT NULL,
	"personnel_count" integer,
	"annual_revenue" real,
	"preferred_provinces" text[] DEFAULT '{}' NOT NULL,
	"excluded_provinces" text[] DEFAULT '{}' NOT NULL,
	"discount_strategy" text,
	"ai_brief" text,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"completion_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profiles_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"folder" text NOT NULL,
	"file_url" text,
	"valid_until" text,
	"status" text DEFAULT 'valid' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"tender_id" integer NOT NULL,
	"tender_title" text,
	"content_json" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"won_tenders" integer DEFAULT 0 NOT NULL,
	"avg_discount_rate" real DEFAULT 0 NOT NULL,
	"encounters" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"masked_key" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_inserted" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_analyzed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"status" text DEFAULT 'success' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"email_address" text,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"min_fit_score" integer DEFAULT 60 NOT NULL,
	"sources" text[] DEFAULT '{"ekap","ilan_gov"}' NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"last_visited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"match_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"fit_score" integer,
	"tender_title" text,
	"tender_id" integer,
	"read_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"saved_search_id" integer NOT NULL,
	"tender_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"account_name" text,
	"account_id" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"blog_body" text,
	"image_url" text,
	"image_prompt" text,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"platform_post_id" text,
	"blog_slug" text,
	"meta_description" text,
	"error_message" text,
	"topic" text,
	"platform_results" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"search_credits" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "award_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"ikn" text NOT NULL,
	"original_ikn" text,
	"awarded_company" text,
	"awarded_price" real,
	"bidder_count" integer,
	"estimated_value" real,
	"award_date" timestamp with time zone,
	"category" text,
	"il" text,
	"agency_name" text,
	"raw_text" text,
	"source_system" text DEFAULT 'ekap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_results_ikn_unique" UNIQUE("ikn")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_items" ADD CONSTRAINT "pipeline_items_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_search_alerts_unique" ON "saved_search_alerts" USING btree ("saved_search_id","tender_id");--> statement-breakpoint
CREATE INDEX "saved_searches_business_idx" ON "saved_searches" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_user_id_unique" ON "users" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_stripe_customer_id_unique" ON "users" USING btree ("stripe_customer_id");