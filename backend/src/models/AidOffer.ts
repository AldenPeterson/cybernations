export interface AidOffer {
  aidId: number;
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
  money: number;
  technology: number;
  soldiers: number;
  date: string;
  reason: string;
  // Calculated date fields (added by backend)
  expirationDate?: string;
  daysUntilExpiration?: number;
  isExpired?: boolean;
}
