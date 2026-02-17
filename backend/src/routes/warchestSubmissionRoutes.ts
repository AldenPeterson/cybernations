import { Router } from 'express';
import { WarchestSubmissionController } from '../controllers/warchestSubmissionController.js';

export const warchestSubmissionRoutes = Router();

// Submit a warchest entry (publicly accessible)
warchestSubmissionRoutes.post('/warchest-submissions', WarchestSubmissionController.submit);

// Get warchest submissions (publicly accessible)
warchestSubmissionRoutes.get('/warchest-submissions', WarchestSubmissionController.list);

