import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '@prisma/client';

export const userRoutes = Router();

// All user routes require authentication and ADMIN role
userRoutes.use(requireAuth);
userRoutes.use(requireRole([UserRole.ADMIN]));

// Get all users
userRoutes.get('/users', UserController.getAllUsers);

// Update a user
userRoutes.put('/users/:id', UserController.updateUser);

