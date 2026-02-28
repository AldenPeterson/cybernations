import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { requireAuth, requireCapability } from '../middleware/authMiddleware.js';

export const userRoutes = Router();

// Get all users (backend protects with manage_users capability)
userRoutes.get('/users', requireAuth, requireCapability('manage_users'), UserController.getAllUsers);

// Update a user
userRoutes.put('/users/:id', requireAuth, requireCapability('manage_users'), UserController.updateUser);

