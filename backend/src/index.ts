import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { apiRoutes } from './routes/api.js';
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
const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE || '604800000', 10); // 7 days
const cookieSecure = process.env.COOKIE_SECURE === 'true';

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
    cookie: {
      maxAge: sessionMaxAge,
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSecure ? 'none' : 'lax',
    },
  })
);

// Routes
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
