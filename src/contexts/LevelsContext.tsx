import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Level, LevelResult, LEVELS, computeLevel } from '../lib/levels';

interface LevelsContextValue {
  levels: Level[];
  getLevel: (lifetimePieces: number) => LevelResult;
}

const LevelsContext = createContext<LevelsContextValue>({
  levels: LEVELS,
  getLevel: (p) => computeLevel(p, LEVELS),
});

export function LevelsProvider({ children }: { children: React.ReactNode }) {
  const [levels, setLevels] = useState<Level[]>(LEVELS);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('level_thresholds')
        .select('level_name, min_pieces')
        .order('min_pieces', { ascending: true });

      if (error || !data?.length) return;

      // Merge DB thresholds with static visual properties (color, bgColor, icon)
      const merged: Level[] = data.map((row) => {
        const fallback = LEVELS.find((l) => l.name === row.level_name);
        return {
          name: row.level_name,
          minPieces: row.min_pieces,
          color: fallback?.color ?? '#9ca3af',
          bgColor: fallback?.bgColor ?? 'rgba(156,163,175,0.15)',
          icon: fallback?.icon ?? '🎯',
        };
      });

      setLevels(merged);
    }

    load();

    const ch = supabase
      .channel('levels-context')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'level_thresholds' }, load)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  const getLevel = (lifetimePieces: number) => computeLevel(lifetimePieces, levels);

  return (
    <LevelsContext.Provider value={{ levels, getLevel }}>
      {children}
    </LevelsContext.Provider>
  );
}

export function useLevels() {
  return useContext(LevelsContext);
}
