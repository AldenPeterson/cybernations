import { useState, useCallback, useMemo } from 'react';
import { type NationConfig } from '../types/nation';

// Utility function for deep comparison
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => deepEqual(obj1[key], obj2[key]));
}

// Get only changed fields between two objects
function getChangedFields<T>(original: T, current: T): Partial<T> {
  const changes: Partial<T> = {};
  
  Object.keys(current as any).forEach(key => {
    const currentValue = (current as any)[key];
    const originalValue = (original as any)[key];
    
    if (!deepEqual(currentValue, originalValue)) {
      (changes as any)[key] = currentValue;
    }
  });
  
  return changes;
}

export function useNationForm(initialNations: NationConfig[] = []) {
  const [nations, setNations] = useState<NationConfig[]>(initialNations);
  const [originalNations, setOriginalNations] = useState<NationConfig[]>(initialNations);

  // Update the nations list (when fetching new data)
  const setNationsData = useCallback((newNations: NationConfig[]) => {
    setNations(newNations);
    setOriginalNations(newNations);
  }, []);

  // Update a specific nation's field
  const updateNationField = useCallback((nationId: number, field: string, value: any) => {
    setNations(prev => prev.map(nation => 
      nation.nation_id === nationId ? { ...nation, [field]: value } : nation
    ));
  }, []);

  // Update a specific nation's slot
  const updateNationSlot = useCallback((nationId: number, slotType: keyof NationConfig['slots'], value: number) => {
    setNations(prev => prev.map(nation => 
      nation.nation_id === nationId 
        ? { 
            ...nation, 
            slots: { 
              ...nation.slots, 
              [slotType]: value 
            } 
          }
        : nation
    ));
  }, []);

  // Check if a nation has any changes
  const hasChanges = useCallback((nationId: number): boolean => {
    const current = nations.find(n => n.nation_id === nationId);
    const original = originalNations.find(n => n.nation_id === nationId);
    
    if (!current || !original) return false;
    
    return !deepEqual(current, original);
  }, [nations, originalNations]);

  // Get only the changed fields for a nation
  const getChangedFieldsForNation = useCallback((nationId: number): Partial<NationConfig> => {
    const current = nations.find(n => n.nation_id === nationId);
    const original = originalNations.find(n => n.nation_id === nationId);
    
    if (!current || !original) return {};
    
    return getChangedFields(original, current);
  }, [nations, originalNations]);

  // Reset a nation to its original state
  const resetNation = useCallback((nationId: number) => {
    const original = originalNations.find(n => n.nation_id === nationId);
    if (original) {
      setNations(prev => prev.map(nation => 
        nation.nation_id === nationId ? original : nation
      ));
    }
  }, [originalNations]);

  // Update original data after successful save
  const markNationAsSaved = useCallback((nationId: number) => {
    const current = nations.find(n => n.nation_id === nationId);
    if (current) {
      setOriginalNations(prev => prev.map(nation => 
        nation.nation_id === nationId ? current : nation
      ));
    }
  }, [nations]);

  // Get nations that have changes
  const getNationsWithChanges = useCallback(() => {
    return nations.filter(nation => hasChanges(nation.nation_id));
  }, [nations, hasChanges]);

  // Check if any nation has changes
  const hasAnyChanges = useMemo(() => {
    return nations.some(nation => hasChanges(nation.nation_id));
  }, [nations, hasChanges]);

  return {
    nations,
    originalNations,
    setNationsData,
    updateNationField,
    updateNationSlot,
    hasChanges,
    getChangedFieldsForNation,
    resetNation,
    markNationAsSaved,
    getNationsWithChanges,
    hasAnyChanges,
  };
}
