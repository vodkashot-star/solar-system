import { pgTable, serial, text, doublePrecision, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Represents a celestial body (Planet, Moon, Asteroid, etc.)
export const celestialBodies = pgTable('celestial_bodies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  mass: doublePrecision('mass'),
  radius: doublePrecision('radius'),
  density: doublePrecision('density'),
  gravity: doublePrecision('gravity'),
  temperature: doublePrecision('temperature'),
  orbitalPeriod: doublePrecision('orbital_period'),
  semiMajorAxis: doublePrecision('semi_major_axis'),
  eccentricity: doublePrecision('eccentricity'),
  inclination: doublePrecision('inclination'),
  rotationPeriod: doublePrecision('rotation_period'),
  axialTilt: doublePrecision('axial_tilt'),

  aiClassification: text('ai_classification'),
  aiConfidenceScore: doublePrecision('ai_confidence_score'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

// User-submitted classification corrections (mirrors spaceAI Correction model)
export const corrections = pgTable('corrections', {
  id: serial('id').primaryKey(),
  bodyId: text('body_id').notNull(),
  predictedType: text('predicted_type').notNull(),
  correctedType: text('corrected_type').notNull(),
  features: jsonb('features').notNull(),
  uncertainty: doublePrecision('uncertainty'),
  source: text('source').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

