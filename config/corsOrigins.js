/**
 * Admin SPA: https://softetsolutions.com (and www)
 * API host:     https://schoolet.org  (nginx → Express /api, public path often /schoolet)
 *
 * Browser sends Origin: https://www.softetsolutions.com — not schoolet.org.
 * Mobile apps send no Origin; they must still be allowed.
 */

const PRODUCTION_FRONTEND_ORIGINS = [
  "https://softetsolutions.com",
  "https://www.softetsolutions.com",
];

const LOCAL_FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function getAllowedOrigins(isProd) {
  const extra = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return [
    ...PRODUCTION_FRONTEND_ORIGINS,
    ...extra,
    ...(isProd ? [] : LOCAL_FRONTEND_ORIGINS),
  ];
}

/** @param {boolean} isProd */
export function createCorsOptions(isProd) {
  const allowedOrigins = getAllowedOrigins(isProd);

  return {
    origin(origin, callback) {
      // React Native / Postman / server-to-server — no Origin header
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      console.warn(`[CORS] Blocked origin: ${origin}`);
      // Do not throw — throwing breaks preflight and surfaces as generic CORS errors
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
    maxAge: 86400,
  };
}
