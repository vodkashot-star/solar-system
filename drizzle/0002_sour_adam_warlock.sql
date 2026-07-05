CREATE TABLE "corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"body_id" text NOT NULL,
	"predicted_type" text NOT NULL,
	"corrected_type" text NOT NULL,
	"features" jsonb NOT NULL,
	"uncertainty" double precision,
	"source" text DEFAULT 'user',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP TABLE "celestial_observations" CASCADE;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "radius" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "density" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "gravity" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "temperature" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "semi_major_axis" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "eccentricity" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "inclination" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "rotation_period" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "axial_tilt" double precision;