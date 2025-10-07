import { Request, Response } from 'express';
import { NuclearReportInput, readNuclearHits, upsertNuclearReports } from '../services/nuclearHitsService.js';

export class NuclearHitsController {
  static ingest = (req: Request, res: Response) => {
    const body = req.body;
    if (!Array.isArray(body)) {
      return res.status(400).json({ error: 'Expected an array of nuclear reports' });
    }

    const inputs: NuclearReportInput[] = body as NuclearReportInput[];
    const result = upsertNuclearReports(inputs);
    return res.json(result);
  };

  static all = (_req: Request, res: Response) => {
    const store = readNuclearHits();
    return res.json(store);
  };
}


