import { logger } from './logger';

/**
 * Required environment variables that must be set for the server to run
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
] as const;

/**
 * Optional environment variables with default values
 */
const OPTIONAL_ENV_VARS = {
  SPACEAI_URL: 'http://localhost:8000',
  ALLOWED_ORIGIN: '*',
  LOG_LEVEL: 'info',
  NODE_ENV: 'development',
} as const;

/**
 * Validated and typed server configuration
 */
export interface ServerConfig {
  database: {
    url: string;
  };
  services: {
    spaceAiUrl: string;
  };
  security: {
    allowedOrigin: string;
  };
  logging: {
    level: string;
  };
  environment: string;
  telegram?: {
    botToken: string;
    opencodeApiKey: string;
    fallbackModel?: string;
  };
  sentry?: {
    dsn: string;
    authToken?: string;
  };
}

/**
 * Validate environment variables and return typed configuration
 * Throws if required variables are missing
 */
export function validateEnv(): ServerConfig {
  const missing = REQUIRED_ENV_VARS.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error({ missing }, message);
    throw new Error(
      `${message}\n\n` +
      `Please set these variables in your .env file or environment.\n` +
      `See .env.example for reference.`
    );
  }

  // Build configuration object
  const config: ServerConfig = {
    database: {
      url: process.env.DATABASE_URL!,
    },
    services: {
      spaceAiUrl: process.env.SPACEAI_URL || OPTIONAL_ENV_VARS.SPACEAI_URL,
    },
    security: {
      allowedOrigin: process.env.ALLOWED_ORIGIN || OPTIONAL_ENV_VARS.ALLOWED_ORIGIN,
    },
    logging: {
      level: process.env.LOG_LEVEL || OPTIONAL_ENV_VARS.LOG_LEVEL,
    },
    environment: process.env.NODE_ENV || OPTIONAL_ENV_VARS.NODE_ENV,
  };

  // Optional Telegram configuration
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.OPENCODE_API_KEY) {
    config.telegram = {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      opencodeApiKey: process.env.OPENCODE_API_KEY,
      fallbackModel: process.env.OPENCODE_FALLBACK_MODEL,
    };
  }

  // Optional Sentry configuration
  if (process.env.SENTRY_DSN) {
    config.sentry = {
      dsn: process.env.SENTRY_DSN,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    };
  }

  // Log configuration (redact sensitive values)
  logger.info({
    config: {
      ...config,
      database: { url: '[REDACTED]' },
      telegram: config.telegram ? { ...config.telegram, botToken: '[REDACTED]', opencodeApiKey: '[REDACTED]' } : undefined,
      sentry: config.sentry ? { ...config.sentry, dsn: '[REDACTED]', authToken: '[REDACTED]' } : undefined,
    },
  }, 'Configuration loaded');

  return config;
}

/**
 * Get validated configuration singleton
 */
let _config: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (!_config) {
    _config = validateEnv();
  }
  return _config;
}
