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
  governmentType: string;
  inWarMode: boolean;
  attackingCasualties?: number;
  defensiveCasualties?: number;
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
  nuclearWeapons: number;
  governmentType: string;
  has_dra: boolean;
  discord_handle?: string;
  slots: AidSlots;
  inWarMode: boolean;
}

export interface AidSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
  send_priority: number;
  receive_priority: number;
}

export enum AidType {
  CASH = 'cash',
  TECHNOLOGY = 'technology'
}
