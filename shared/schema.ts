import { pgTable, serial, text, doublePrecision, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Represents a celestial body (Planet, Moon, Asteroid, etc.)
export const celestialBodies = pgTable('celestial_bodies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // e.g., 'planet', 'dwarf_planet', 'moon'
  mass: doublePrecision('mass'),
  orbitalPeriod: doublePrecision('orbital_period'), // in Earth days
  
  // AI Metadata (To store outputs from your models)
  aiClassification: text('ai_classification'),
  aiConfidenceScore: doublePrecision('ai_confidence_score'),
  
  // Simulation tracking
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Represents periodic observations or sensor data from your AI
export const celestialObservations = pgTable('celestial_observations', {
  id: serial('id').primaryKey(),
  bodyId: serial('body_id').references(() => celestialBodies.id),
  coordinates: jsonb('coordinates'), // { x, y, z } for 3D space tracking
  observationDate: timestamp('observation_date').defaultNow(),
});

