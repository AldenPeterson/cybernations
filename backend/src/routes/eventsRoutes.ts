import { Router } from 'express';
import { EventsController } from '../controllers/eventsController.js';

export const eventsRoutes = Router();

// Get events
eventsRoutes.get('/events', EventsController.getEvents);

