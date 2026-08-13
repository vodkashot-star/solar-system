import { type Server } from "node:http";

import cors from "cors";
import compression from "compression";
import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import * as Sentry from "@sentry/node";

import { registerRoutes } from "./routes";
import { logger, requestLogger } from "./logger";

export const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Structured logging middleware
app.use(requestLogger);

// Gzip/brotli for text assets (JS/CSS/JSON/HTML). GLBs are already
// Draco+JPEG compressed so the filter skips them.
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const type = (res.getHeader("Content-Type") as string) ?? "";
    if (type.includes("model/gltf") || type.includes("image/")) return false;
    return compression.filter(req, res);
  },
}));

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  // Sentry error handler - capture errors before they're handled
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    
    // Use request logger if available, fallback to root logger
    const log = req.log || logger;
    log.error({ err, status, message }, 'Request error');
  });

  await setup(app, server);

  // PORT env override (default 5000) — no reusePort: a stale server on the same
  // port would silently split traffic via SO_REUSEPORT instead of failing loudly.
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    logger.info({ port, host: "0.0.0.0" }, 'Server started');
  });
}
