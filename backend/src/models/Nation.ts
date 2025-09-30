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
  nuclearWeapons: number;
  warStatus: string;
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
  has_dra: boolean;
  discord_handle?: string;
  slots: AidSlots;
  warStatus: string;
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
