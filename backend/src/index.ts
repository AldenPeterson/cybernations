import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import rateLimit from 'express-rate-limit';
import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/authRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { pool } from './utils/prisma.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cybernations-frontend.vercel.app',
    'https://www.cybernations.net',
    'https://cybernations.net',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in environment variables');
}

// Initialize PostgreSQL session store
const PgSession = connectPgSimple(session);

// Create session store with error handling
const sessionStore = new PgSession({
  pool: pool,
  tableName: 'user_sessions', // Optional: custom table name
  createTableIfMissing: true, // Automatically creates the sessions table
});

// Add error handlers for the store
sessionStore.on('connect', () => {
  console.log('✅ PostgreSQL session store connected');
});

sessionStore.on('error', (error: Error) => {
  console.error('❌ PostgreSQL session store error:', error);
});

// Session middleware configuration
const sessionConfig: session.SessionOptions = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET!,
  name: process.env.SESSION_NAME || 'sessionId',
  resave: false, // Can be false with database store (more efficient)
  saveUninitialized: true, // Save session even if empty (needed for OAuth state)
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax', // 'lax' allows OAuth redirects while still providing CSRF protection
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '604800000', 10), // 7 days default
    // Don't set domain in development to allow localhost cookies to work
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  },
};

app.use(session(sessionConfig));

// Rate limiting for auth endpoints
// More lenient in development, stricter in production
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // Much more lenient in dev (100 requests per 15 min)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // In development, use a shorter window to recover faster
  ...(process.env.NODE_ENV === 'development' && {
    windowMs: 1 * 60 * 1000, // 1 minute in dev for faster recovery
  }),
});

// Routes
// Only apply rate limiting in production, or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_AUTH_RATE_LIMIT === 'true') {
  app.use('/api/auth', authLimiter, authRoutes);
} else {
  app.use('/api/auth', authRoutes);
}
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
