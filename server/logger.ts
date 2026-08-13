import pino from 'pino';
import type { Request, Response, NextFunction } from 'express';

/**
 * Structured logger using pino
 * - Development: pretty-printed colorized output
 * - Production: JSON structured logs for aggregation
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { 
        target: 'pino-pretty', 
        options: { 
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        } 
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Generate a short request correlation ID
 */
function generateReqId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Request logging middleware
 * Attaches a child logger with correlation ID to req.log
 */
export function requestLogger(req: Request & { log?: pino.Logger }, res: Response, next: NextFunction) {
  const start = Date.now();
  const reqId = generateReqId();
  
  // Attach child logger with request ID to request object
  req.log = logger.child({ reqId });
  
  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
    };
    
    if (res.statusCode >= 500) {
      req.log!.error(logData, 'Request error');
    } else if (res.statusCode >= 400) {
      req.log!.warn(logData, 'Request client error');
    } else {
      req.log!.info(logData, 'Request completed');
    }
  });
  
  next();
}

/**
 * Type-safe extension of Express Request with logger
 */
declare global {
  namespace Express {
    interface Request {
      log?: pino.Logger;
    }
  }
}
