import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { AllianceController } from '../controllers/allianceController.js';
import { RoleCapabilityController } from '../controllers/roleCapabilityController.js';
import { requireAuth, requireCapability } from '../middleware/authMiddleware.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth);

// Role capabilities (manage_users) - backend protects these routes
adminRoutes.get('/capabilities', requireCapability('manage_users'), RoleCapabilityController.listCapabilities);
adminRoutes.get('/roles/:role/capabilities', requireCapability('manage_users'), RoleCapabilityController.getRoleCapabilities);
adminRoutes.put('/roles/:role/capabilities', requireCapability('manage_users'), RoleCapabilityController.setRoleCapabilities);

// Rest of admin routes require manage_all_alliance capability
adminRoutes.use(requireCapability('manage_all_alliance'));

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

