import { Router } from 'express';
import { CsvController } from '../controllers/csvController.js';

export const csvRoutes = Router();

// CSV management routes
// Format: /api/csv/:type/:action
// Types: nations, aid-offers, wars
// Actions: download, parse, update, sync

csvRoutes.post('/csv/:type/download', CsvController.downloadCsv);
csvRoutes.get('/csv/:type/parse', CsvController.parseCsv);
csvRoutes.post('/csv/:type/update', CsvController.updateFromCsv);
csvRoutes.post('/csv/:type/sync', CsvController.syncCsv);

