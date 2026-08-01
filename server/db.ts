import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const queryClient = postgres(connectionString, {
  // Keep Neon latency in check: fail fast and let the route-level file-cache
  // fallback (routes.ts getMergedAICache) take over instead of hanging.
  connect_timeout: 2,
  idle_timeout: 5,
  max_lifetime: 60 * 10,
});
export const db = drizzle(queryClient);
