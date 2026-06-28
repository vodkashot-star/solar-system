CREATE TABLE "celestial_bodies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"mass" double precision,
	"orbital_period" double precision,
	"ai_classification" text,
	"ai_confidence_score" double precision,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "celestial_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"body_id" serial NOT NULL,
	"coordinates" jsonb,
	"observation_date" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "celestial_observations" ADD CONSTRAINT "celestial_observations_body_id_celestial_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."celestial_bodies"("id") ON DELETE no action ON UPDATE no action;