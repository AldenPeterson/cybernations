import { Router } from 'express';
import { WarchestSubmissionController } from '../controllers/warchestSubmissionController.js';

export const warchestSubmissionRoutes = Router();

// Submit a warchest entry (available to any authenticated user)
warchestSubmissionRoutes.post('/warchest-submissions', WarchestSubmissionController.submit);

// Get warchest submissions (available to any authenticated user)
warchestSubmissionRoutes.get('/warchest-submissions', WarchestSubmissionController.list);

