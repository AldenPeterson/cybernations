import { Router } from 'express';
import { WarManagementController } from '../controllers/warManagementController.js';
import { validateAllianceId } from '../middleware/validation.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '@prisma/client';

export const warManagementRoutes = Router();

// Get wars organized by nation for a specific alliance
warManagementRoutes.get('/alliances/:allianceId/nation-wars', validateAllianceId, WarManagementController.getNationWars);

// Get defending wars for a specific alliance
warManagementRoutes.get('/alliances/:allianceId/defending-wars', validateAllianceId, WarManagementController.getDefendingWars);

// Get defending wars statistics for an alliance
warManagementRoutes.get('/alliances/:allianceId/defending-wars-stats', validateAllianceId, WarManagementController.getDefendingWarsStats);

// War assignments for an alliance (WAR_MANAGER/ADMIN only)
warManagementRoutes.get(
  '/alliances/:allianceId/war-assignments',
  validateAllianceId,
  requireAuth,
  requireRole([UserRole.WAR_MANAGER, UserRole.ADMIN]),
  WarManagementController.getWarAssignments
);

warManagementRoutes.post(
  '/alliances/:allianceId/war-assignments',
  validateAllianceId,
  requireAuth,
  requireRole([UserRole.WAR_MANAGER, UserRole.ADMIN]),
  WarManagementController.createWarAssignment
);

warManagementRoutes.delete(
  '/alliances/:allianceId/war-assignments/:assignmentId',
  validateAllianceId,
  requireAuth,
  requireRole([UserRole.WAR_MANAGER, UserRole.ADMIN]),
  WarManagementController.deleteWarAssignment
);

// Get active war counts (attacking vs defending) for an alliance
warManagementRoutes.get('/alliances/:allianceId/war-counts', validateAllianceId, WarManagementController.getAllianceWarCounts);
