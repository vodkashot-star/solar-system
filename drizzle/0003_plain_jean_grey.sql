ALTER TABLE "celestial_bodies" ADD COLUMN "visual_radius" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "orbit" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "orbit_speed" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "spin_speed" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "tilt" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "phase" double precision;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "fact" text;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "parent_body" text;--> statement-breakpoint
ALTER TABLE "celestial_bodies" ADD COLUMN "has_rings" text DEFAULT 'false';