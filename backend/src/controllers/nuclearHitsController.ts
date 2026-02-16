import { Request, Response } from 'express';
import { NuclearReportInput, readNuclearHits, upsertNuclearReports, computeNuclearAttemptDistribution, computeNuclearTimeline } from '../services/nuclearHitsService.js';
import { loadDataFromFilesWithUpdate, createNationsDictionary } from '../services/dataProcessingService.js';

export class NuclearHitsController {
  static ingest = async (req: Request, res: Response) => {
    const body = req.body;
    if (!Array.isArray(body)) {
      return res.status(400).json({ error: 'Expected an array of nuclear reports' });
    }

    const inputs: NuclearReportInput[] = body as NuclearReportInput[];
    console.log(`[Nuclear Data] Ingest endpoint called with ${inputs.length} nuclear reports`);
    const result = await upsertNuclearReports(inputs);
    console.log(`[Nuclear Data] Ingest completed: added ${result.added} new reports, skipped ${result.skipped}`);
    return res.json(result);
  };

  static all = (_req: Request, res: Response) => {
    const store = readNuclearHits();
    return res.json(store);
  };

  static stats = async (_req: Request, res: Response) => {
    const stats = await computeNuclearAttemptDistribution();
    try {
      const { nations } = await loadDataFromFilesWithUpdate();
      const dict = createNationsDictionary(nations);
      const byPairEnriched = (stats.byPair || []).map((row: any) => {
        const attackerId = parseInt(row.attackingNation) || 0;
        const defenderId = parseInt(row.defendingNation) || 0;
        const a = dict[attackerId];
        const d = dict[defenderId];
        return {
          ...row,
          attackerId,
          attackerNationName: a?.nationName || row.attackingNation,
          attackerRulerName: a?.rulerName || undefined,
          defenderId,
          defenderNationName: d?.nationName || row.defendingNation,
          defenderRulerName: d?.rulerName || undefined,
        };
      });
      return res.json({ ...stats, byPair: byPairEnriched });
    } catch (_e) {
      // Fallback to raw ids if nation loading fails
      return res.json(stats);
    }
  };

  static timeline = (req: Request, res: Response) => {
    const intervalParam = req.query.intervalMinutes;
    let intervalMinutes = 5;
    if (typeof intervalParam === 'string') {
      const n = parseInt(intervalParam);
      if (!Number.isNaN(n) && n > 0 && n <= 24 * 60) {
        intervalMinutes = n;
      }
    }
    const result = computeNuclearTimeline(intervalMinutes);
    return res.json(result);
  };
}


