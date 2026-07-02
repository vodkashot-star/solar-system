CREATE TABLE "ai_cache" (
	"body_id" text PRIMARY KEY NOT NULL,
	"classification" text NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb,
	"features" jsonb DEFAULT '[]'::jsonb,
	"similar_objects" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prediction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"body_id" text,
	"target" text NOT NULL,
	"feature_values" jsonb NOT NULL,
	"prediction" double precision NOT NULL,
	"ci_lower" double precision,
	"ci_upper" double precision,
	"created_at" timestamp DEFAULT now()
);
