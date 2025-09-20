export interface Nation {
  id: number;
  rulerName: string;
  nationName: string;
  alliance: string;
  allianceId: number;
  team: string;
  strength: number;
  activity: string;
  technology: string;
  infrastructure: string;
}

export interface CategorizedNation {
  id: number;
  rulerName: string;
  nationName: string;
  allianceId: number;
  alliance: string;
  technology: string;
  infrastructure: string;
  strength: string;
  activity: string;
  slots: AidSlots;
}

export interface AidSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
}

export enum AidType {
  CASH = 'cash',
  TECHNOLOGY = 'technology'
}
