import { pgTable, serial, text, doublePrecision, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Represents a celestial body (Planet, Moon, Asteroid, etc.)
export const celestialBodies = pgTable('celestial_bodies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  mass: doublePrecision('mass'),
  orbitalPeriod: doublePrecision('orbital_period'),

  aiClassification: text('ai_classification'),
  aiConfidenceScore: doublePrecision('ai_confidence_score'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Represents periodic observations or sensor data from your AI
export const celestialObservations = pgTable('celestial_observations', {
  id: serial('id').primaryKey(),
  bodyId: serial('body_id').references(() => celestialBodies.id),
  coordinates: jsonb('coordinates'),
  observationDate: timestamp('observation_date').defaultNow(),
});

// Precomputed AI classification results per body (mirrors spaceAI AICache model)
export const aiCache = pgTable('ai_cache', {
  bodyId: text('body_id').primaryKey(),
  classification: text('classification').notNull(),
  confidence: doublePrecision('confidence').notNull().default(0),
  alternatives: jsonb('alternatives').default([]),
  features: jsonb('features').default([]),
  similarObjects: jsonb('similar_objects').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Regression prediction history (mirrors spaceAI PredictionLog model)
export const predictionLogs = pgTable('prediction_logs', {
  id: serial('id').primaryKey(),
  bodyId: text('body_id'),
  target: text('target').notNull(),
  featureValues: jsonb('feature_values').notNull(),
  prediction: doublePrecision('prediction').notNull(),
  ciLower: doublePrecision('ci_lower'),
  ciUpper: doublePrecision('ci_upper'),
  createdAt: timestamp('created_at').defaultNow(),
});

