import { Router } from 'express';
import { WarchestSubmissionController } from '../controllers/warchestSubmissionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';


export const warchestSubmissionRoutes = Router();

// Submit a warchest entry (available to any authenticated user)
warchestSubmissionRoutes.post('/warchest-submissions', requireAuth, WarchestSubmissionController.submit);

// Get warchest submissions (available to any authenticated user)
warchestSubmissionRoutes.get('/warchest-submissions', requireAuth,WarchestSubmissionController.list);

