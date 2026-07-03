export interface Level {
  name: string;
  minPieces: number;
  color: string;
  bgColor: string;
  icon: string;
}

// Static fallback — used before DB loads and for seeding defaults
export const LEVELS: Level[] = [
  { name: 'Rookie', minPieces: 0, color: '#9ca3af', bgColor: 'rgba(156,163,175,0.15)', icon: '🎯' },
  { name: 'Novice', minPieces: 50, color: '#60a5fa', bgColor: 'rgba(96,165,250,0.15)', icon: '📈' },
  { name: 'Apprentice', minPieces: 150, color: '#34d399', bgColor: 'rgba(52,211,153,0.15)', icon: '⚡' },
  { name: 'Performer', minPieces: 300, color: '#fbbf24', bgColor: 'rgba(251,191,36,0.15)', icon: '🔥' },
  { name: 'Pro', minPieces: 500, color: '#f97316', bgColor: 'rgba(249,115,22,0.15)', icon: '💪' },
  { name: 'Specialist', minPieces: 750, color: '#ec4899', bgColor: 'rgba(236,72,153,0.15)', icon: '🎖️' },
  { name: 'Expert', minPieces: 1000, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.15)', icon: '🏅' },
  { name: 'Veteran', minPieces: 1500, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.15)', icon: '⭐' },
  { name: 'Elite', minPieces: 2000, color: '#FFD700', bgColor: 'rgba(255,215,0,0.15)', icon: '👑' },
  { name: 'Master', minPieces: 2750, color: '#FFD700', bgColor: 'rgba(255,215,0,0.2)', icon: '🏆' },
  { name: 'Champion', minPieces: 3750, color: '#10B981', bgColor: 'rgba(16,185,129,0.2)', icon: '🥇' },
  { name: 'Grandmaster', minPieces: 5000, color: '#10B981', bgColor: 'rgba(16,185,129,0.25)', icon: '💎' },
  { name: 'Legend', minPieces: 7000, color: '#FFD700', bgColor: 'rgba(255,215,0,0.25)', icon: '🌟' },
  { name: 'Mythic', minPieces: 10000, color: '#f43f5e', bgColor: 'rgba(244,63,94,0.2)', icon: '🔮' },
  { name: 'Immortal', minPieces: 15000, color: '#FFD700', bgColor: 'rgba(255,215,0,0.3)', icon: '⚡' },
  { name: 'GOAT', minPieces: 25000, color: '#FFD700', bgColor: 'rgba(255,215,0,0.35)', icon: '🐐' },
];

export type LevelResult = { current: Level; next: Level | null; progress: number; piecesLeft: number };

// computeLevel accepts a dynamic level array (from DB) or falls back to static LEVELS
export function computeLevel(lifetimePieces: number, levels: Level[] = LEVELS): LevelResult {
  const sorted = [...levels].sort((a, b) => a.minPieces - b.minPieces);
  let currentIndex = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (lifetimePieces >= sorted[i].minPieces) {
      currentIndex = i;
      break;
    }
  }

  const current = sorted[currentIndex];
  const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  let progress = 100;
  let piecesLeft = 0;

  if (next) {
    const rangeStart = current.minPieces;
    const rangeEnd = next.minPieces;
    const earned = lifetimePieces - rangeStart;
    const total = rangeEnd - rangeStart;
    progress = Math.min(100, Math.round((earned / total) * 100));
    piecesLeft = rangeEnd - lifetimePieces;
  }

  return { current, next, progress, piecesLeft };
}

// Legacy alias — still works but uses static LEVELS
export function getLevel(lifetimePieces: number): LevelResult {
  return computeLevel(lifetimePieces, LEVELS);
}
