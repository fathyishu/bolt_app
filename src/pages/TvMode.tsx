import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Crown, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, Profile } from '../lib/supabase';
import { getLevel } from '../lib/levels';

export default function TvMode() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('monthly_pieces', { ascending: false })
        .limit(10);
      if (data) setProfiles(data as Profile[]);
    }
    load();
    const interval = setInterval(() => {
      load();
      setTick((t) => t + 1);
    }, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const top3 = profiles.slice(0, 3);
  const rest = profiles.slice(3);

  const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const MEDAL_ICONS = ['👑', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-dark-400 flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-surface-200/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center shadow-gold">
              <Trophy className="w-6 h-6 text-gold-500" />
            </div>
            <div>
              <div className="text-white font-bold text-2xl">MJ Sports</div>
              <div className="text-gold-500/70 text-sm tracking-widest uppercase">Elite Performance Board</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl font-bold text-white tabular-nums">
              {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-white/40 text-sm">
              {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-8 py-8 flex flex-col gap-8">
        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-6">
          {/* 2nd */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center pt-12"
          >
            {top3[1] ? (
              <LeaderCard
                rank={2}
                profile={top3[1]}
                medalColor={MEDAL_COLORS[1]}
                medalIcon={MEDAL_ICONS[1]}
              />
            ) : (
              <EmptySlot rank={2} />
            )}
          </motion.div>

          {/* 1st */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-center"
          >
            {top3[0] ? (
              <LeaderCard
                rank={1}
                profile={top3[0]}
                medalColor={MEDAL_COLORS[0]}
                medalIcon={MEDAL_ICONS[0]}
                isTop
              />
            ) : (
              <EmptySlot rank={1} />
            )}
          </motion.div>

          {/* 3rd */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center pt-16"
          >
            {top3[2] ? (
              <LeaderCard
                rank={3}
                profile={top3[2]}
                medalColor={MEDAL_COLORS[2]}
                medalIcon={MEDAL_ICONS[2]}
              />
            ) : (
              <EmptySlot rank={3} />
            )}
          </motion.div>
        </div>

        {/* Rest of leaderboard */}
        {rest.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="grid divide-y divide-white/5">
              {rest.map((p, idx) => {
                const level = getLevel(p.lifetime_pieces);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 + 0.4 }}
                    className="flex items-center gap-6 px-8 py-4"
                  >
                    <div className="text-3xl font-black text-white/20 w-10 text-center">#{idx + 4}</div>
                    <div className="w-12 h-12 rounded-full bg-surface-50 flex items-center justify-center text-xl font-bold text-white/60 flex-shrink-0">
                      {p.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="text-xl font-bold text-white">{p.full_name}</div>
                      <div className="text-sm" style={{ color: level.current.color }}>
                        {level.current.icon} {level.current.name}
                      </div>
                    </div>
                    {p.current_streak > 0 && (
                      <div className="flex items-center gap-1.5 text-orange-400">
                        <Flame className="w-5 h-5" />
                        <span className="text-lg font-bold">{p.current_streak}</span>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-2xl font-black text-white">{p.monthly_pieces.toLocaleString()}</div>
                      <div className="text-white/30 text-sm">pieces this month</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer ticker */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between text-white/30 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold-500/50" />
            Live leaderboard — refreshes every 30 seconds
          </div>
          <div>Commission: ₹8 per piece closed</div>
        </div>
      </main>
    </div>
  );
}

function LeaderCard({ rank, profile, medalColor, medalIcon, isTop = false }: {
  rank: number; profile: Profile; medalColor: string; medalIcon: string; isTop?: boolean;
}) {
  const level = getLevel(profile.lifetime_pieces);
  return (
    <div className={`text-center w-full ${isTop ? '' : 'opacity-90'}`}>
      <div className="text-4xl mb-2">{medalIcon}</div>
      <div
        className={`${isTop ? 'w-24 h-24' : 'w-20 h-20'} rounded-full border-2 flex items-center justify-center text-3xl font-black mx-auto mb-3`}
        style={{
          borderColor: medalColor,
          backgroundColor: `${medalColor}15`,
          color: medalColor,
          boxShadow: isTop ? `0 0 40px ${medalColor}40` : `0 0 20px ${medalColor}20`,
        }}
      >
        {profile.full_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className={`font-black ${isTop ? 'text-2xl text-white' : 'text-xl text-white/90'}`}>
        {profile.full_name?.split(' ')[0]}
      </div>
      <div className="text-sm mt-0.5" style={{ color: level.current.color }}>
        {level.current.icon} {level.current.name}
      </div>
      <div
        className={`font-black mt-2 ${isTop ? 'text-4xl' : 'text-3xl'}`}
        style={{ color: medalColor }}
      >
        {profile.monthly_pieces.toLocaleString()}
      </div>
      <div className="text-white/40 text-sm">pieces</div>
      {profile.current_streak > 0 && (
        <div className="flex items-center justify-center gap-1 mt-2 text-orange-400">
          <Flame className="w-4 h-4" />
          <span className="font-bold">{profile.current_streak}d streak</span>
        </div>
      )}
    </div>
  );
}

function EmptySlot({ rank }: { rank: number }) {
  return (
    <div className="text-center w-full opacity-40">
      <div className="text-4xl mb-2">{rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}</div>
      <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mx-auto mb-3">
        <span className="text-white/20 font-bold text-2xl">?</span>
      </div>
      <div className="text-white/40 font-bold text-lg">Unclaimed</div>
      <div className="text-white/20 text-sm">#{rank} position</div>
    </div>
  );
}
