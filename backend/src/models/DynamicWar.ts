export interface DynamicWar {
  warId: number;
  declaringId: number;
  declaringRuler: string;
  declaringNation: string;
  declaringAlliance: string;
  declaringAllianceId: number;
  receivingId: number;
  receivingRuler: string;
  receivingNation: string;
  receivingAlliance: string;
  receivingAllianceId: number;
  status: string;
  date: string;
  endDate: string;
  reason?: string;
  destruction?: string;
  attackPercent?: number;
  defendPercent?: number;
  addedAt: string; // ISO timestamp when this war was added dynamically
  source: 'chrome_extension' | 'manual' | 'api'; // Track the source of the dynamic war
}
