// client/src/lib/config.ts

// API base URL: switches between local dev and production

// Recommended approach: Use a relative path /api for production if the frontend 
// and backend are hosted on the same domain (solar-system.xyz), and use 
// the full URL for local development if you are testing against the live server.
//
// NOTE: Based on your domain, we assume the API lives at the root /api path.
// If the API and client are served from the same domain, using '/api' is safest.
// For explicit control, we set the production URL fully.

const PRODUCTION_API_BASE = "https://solar-system-o8oi.onrender.com";
const DEVELOPMENT_API_BASE = "/api"; // Relies on dev server (like Vite) proxying /api to localhost:5000

export const API_BASE =
  import.meta.env.MODE === "production"
    ? PRODUCTION_API_BASE
    : DEVELOPMENT_API_BASE;



