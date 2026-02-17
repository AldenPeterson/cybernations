import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { apiRoutes } from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { pool } from './utils/prisma.js';
import { getCookieConfig } from './utils/cookieConfig.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// In production behind a proxy (e.g. Vercel, Render, Railway, etc.),
// trust the first proxy so that req.secure is correctly set for HTTPS requests.
// This is required for secure cookies (cookie.secure = true) to be set correctly.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  // Allow cookies to be set
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cybernations-frontend.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET || 'development-session-secret-change-me';
const sessionName = process.env.SESSION_NAME || 'sessionId';
const cookieConfig = getCookieConfig();

app.use(
  session({
    store: new PgSession({
      pool,
      // Use a dedicated table name for sessions; will be auto-created if missing
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    name: sessionName,
    resave: false,
    saveUninitialized: false,
    cookie: cookieConfig,
  })
);

// Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check cookie configuration (remove in production if needed)
app.get('/debug/cookie-config', (req, res) => {
  res.json({
    COOKIE_SECURE_env: process.env.COOKIE_SECURE,
    cookieConfig,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
