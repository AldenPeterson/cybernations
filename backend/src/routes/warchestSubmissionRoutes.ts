import { Router } from 'express';
import { WarchestSubmissionController } from '../controllers/warchestSubmissionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const warchestSubmissionRoutes = Router();

// All routes require authentication (any logged-in user can access - no role restrictions)
warchestSubmissionRoutes.use(requireAuth);

// Submit a warchest entry (available to any authenticated user)
warchestSubmissionRoutes.post('/warchest-submissions', WarchestSubmissionController.submit);

// Get warchest submissions (available to any authenticated user)
warchestSubmissionRoutes.get('/warchest-submissions', WarchestSubmissionController.list);

