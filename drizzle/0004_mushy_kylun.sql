CREATE TABLE "chat_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"body_id" integer NOT NULL,
	"sender_name" text NOT NULL,
	"message" text NOT NULL,
	"is_ai" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"name" text NOT NULL,
	"current_body_id" integer NOT NULL,
	"reputation" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "player_characters_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_body_id_celestial_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."celestial_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_characters" ADD CONSTRAINT "player_characters_current_body_id_celestial_bodies_id_fk" FOREIGN KEY ("current_body_id") REFERENCES "public"."celestial_bodies"("id") ON DELETE no action ON UPDATE no action;