import { Router } from 'express';
import { DonationsController } from '../controllers/donationsController.js';

export const donationsRoutes = Router();

donationsRoutes.get('/donations/summary', DonationsController.getDonationSummary);
