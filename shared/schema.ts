import { pgTable, serial, text, doublePrecision, timestamp, jsonb, integer, bigint } from 'drizzle-orm/pg-core';

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

  // Scene-rendering params (used by the client to place custom bodies in the 3D scene)
  visualRadius: doublePrecision('visual_radius'),
  orbit: doublePrecision('orbit'),
  orbitSpeed: doublePrecision('orbit_speed'),
  spinSpeed: doublePrecision('spin_speed'),
  tilt: doublePrecision('tilt'),
  phase: doublePrecision('phase'),
  color: text('color'),
  fact: text('fact'),
  parentBody: text('parent_body'),
  hasRings: text('has_rings').default('false'),

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

// Telegram bot: player characters linked to celestial bodies in the 3D solar system
export const playerCharacters = pgTable('player_characters', {
  id: serial('id').primaryKey(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique().notNull(),
  name: text('name').notNull(),
  // FK must be integer — celestialBodies.id is a serial (integer), a text FK
  // column would not match the referenced primary key type in Postgres.
  currentBodyId: integer('current_body_id').notNull().references(() => celestialBodies.id),
  reputation: integer('reputation').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Telegram bot: chat history per celestial body / station
export const chatLogs = pgTable('chat_logs', {
  id: serial('id').primaryKey(),
  bodyId: integer('body_id').notNull().references(() => celestialBodies.id),
  senderName: text('sender_name').notNull(),
  message: text('message').notNull(),
  isAi: integer('is_ai').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

