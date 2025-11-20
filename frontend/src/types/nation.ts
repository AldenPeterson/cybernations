export interface NationSlots {
  sendTech: number;
  sendCash: number;
  getTech: number;
  getCash: number;
  external: number;
  send_priority: number;
  receive_priority: number;
}

export interface NationConfig {
  nation_id: number;
  ruler_name: string;
  nation_name: string;
  discord_handle: string;
  has_dra: boolean;
  notes?: string;
  slots: NationSlots;
  inWarMode: boolean;
  current_stats?: {
    technology: string;
    infrastructure: string;
    strength: string;
  };
}
