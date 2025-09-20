import { AidOffer } from './AidOffer.js';
import { Nation } from './Nation.js';

export interface AidSlot {
  slotNumber: number;
  aidOffer: AidOffer | null;
  isOutgoing: boolean;
}

export interface NationAidSlots {
  nation: Nation;
  aidSlots: AidSlot[];
}
