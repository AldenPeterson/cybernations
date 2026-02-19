import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { AllianceController } from '../controllers/allianceController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '@prisma/client';

export const adminRoutes = Router();

// All admin routes require authentication and ADMIN role
adminRoutes.use(requireAuth);
adminRoutes.use(requireRole([UserRole.ADMIN]));

// Get all alliances (no filtering)
adminRoutes.get('/alliances', AllianceController.getAllAlliances);

// Search nations
adminRoutes.get('/nations/search', AdminController.searchNations);

// Set nation targeting alliance override
adminRoutes.put('/nations/:nationId/targeting-alliance', AdminController.setNationTargetingAlliance);

// Search wars
adminRoutes.get('/wars/search', AdminController.searchWars);

// Update war alliance IDs
adminRoutes.put('/wars/:warId/alliance-ids', AdminController.updateWarAllianceIds);

