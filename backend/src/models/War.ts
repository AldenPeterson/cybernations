export interface War {
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
  // Calculated war end date fields
  formattedEndDate?: string;
  daysUntilExpiration?: number;
  expirationColor?: string;
  isExpired?: boolean;
}
