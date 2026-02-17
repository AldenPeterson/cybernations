import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '@prisma/client';

export const userRoutes = Router();

// Get all users
userRoutes.get('/users', requireAuth, requireRole([UserRole.ADMIN]),UserController.getAllUsers);

// Update a user
userRoutes.put('/users/:id', requireAuth, requireRole([UserRole.ADMIN]), UserController.updateUser);

