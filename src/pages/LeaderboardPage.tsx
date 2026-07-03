import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star, TrendingUp } from 'lucide-react';
import { supabase, Profile, TrophyCase } from '../lib/supabase';
import { getLevel } from '../lib/levels';

function PodiumBlock({ rank, profile, pieces }: { rank: 1 | 2 | 3; profile: Profile | null; pieces: number }) {
  const heights = { 1: 'h-36', 2: 'h-24', 3: 'h-20' };
  const colors = {
    1: { main: '#FFD700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)' },
    2: { main: '#C0C0C0', bg: 'rgba(192,192,192,0.1)', border: 'rgba(192,192,192,0.3)' },
    3: { main: '#CD7F32', bg: 'rgba(205,127,50,0.1)', border: 'rgba(205,127,50,0.3)' },
  };
  const icons = { 1: <Crown className="w-5 h-5" />, 2: <Medal className="w-4 h-4" />, 3: <Star className="w-4 h-4" /> };
  const c = colors[rank];
  const level = profile ? getLevel(profile.lifetime_pieces) : null;

  return (
    <div className={`flex flex-col items-center ${rank === 1 ? 'z-10' : ''}`}>
      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.1 + 0.3 }}
        className="mb-2 relative"
      >
        {rank === 1 && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-float">👑</div>
        )}
        <div
          className={`${rank === 1 ? 'w-16 h-16' : 'w-12 h-12'} rounded-full flex items-center justify-center text-xl font-bold border-2`}
          style={{ backgroundColor: c.bg, borderColor: c.border }}
        >
          <span style={{ color: c.main }}>
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: c.main, color: '#000' }}
        >
          {rank}
        </div>
      </motion.div>

      {/* Name */}
      <div className="text-center mb-2">
        <div className={`font-bold ${rank === 1 ? 'text-base text-white' : 'text-sm text-white/80'}`}>
          {profile?.full_name?.split(' ')[0] || 'TBD'}
        </div>
        {level && (
          <div className="text-xs mt-0.5" style={{ color: level.current.color }}>
            {level.current.name}
          </div>
        )}
        <div className="font-bold text-sm mt-0.5" style={{ color: c.main }}>{pieces}p</div>
      </div>

      {/* Podium block */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: rank * 0.15 + 0.5, duration: 0.5, ease: 'easeOut' }}
        style={{ originY: 1, backgroundColor: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 0 20px ${c.main}20` }}
        className={`${heights[rank]} w-20 rounded-t-xl flex flex-col items-center justify-end pb-3`}
      >
        <div style={{ color: c.main }}>{icons[rank]}</div>
      </motion.div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [monthlyTop, setMonthlyTop] = useState<Profile[]>([]);
  const [careerLegends, setCareerLegends] = useState<Profile[]>([]);
  const [trophyHistory, setTrophyHistory] = useState<TrophyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'monthly' | 'career'>('monthly');

  useEffect(() => {
    async function load() {
      const { data: monthly } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .eq('is_active', true)
        .order('monthly_pieces', { ascending: false })
        .limit(10);
      if (monthly) setMonthlyTop(monthly as Profile[]);

      const { data: career } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .eq('is_active', true)
        .order('lifetime_pieces', { ascending: false })
        .limit(10);
      if (career) setCareerLegends(career as Profile[]);

      const { data: trophy } = await supabase
        .from('trophy_case')
        .select('*, profile:profiles(full_name, role)')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(30);
      if (trophy) setTrophyHistory(trophy as TrophyCase[]);

      setLoading(false);
    }
    load();
  }, []);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const activeList = tab === 'monthly' ? monthlyTop : careerLegends;
  const top3 = activeList.slice(0, 3);
  const rest = activeList.slice(3);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-gold-500" />
          Leaderboard
        </h1>
        <p className="text-white/40 text-sm mt-0.5">Who's running the game?</p>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-surface-200 rounded-xl p-1 w-fit">
        {(['monthly', 'career'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-gold-500 text-dark-400' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t === 'monthly' ? 'Monthly Top' : 'Career Legends'}
          </button>
        ))}
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="glass-card p-8">
          <div className="flex items-end justify-center gap-4">
            {/* 2nd place */}
            {top3[1] ? (
              <PodiumBlock rank={2} profile={top3[1]} pieces={tab === 'monthly' ? top3[1].monthly_pieces : top3[1].lifetime_pieces} />
            ) : (
              <PodiumBlock rank={2} profile={null} pieces={0} />
            )}
            {/* 1st place */}
            <PodiumBlock rank={1} profile={top3[0]} pieces={tab === 'monthly' ? top3[0].monthly_pieces : top3[0].lifetime_pieces} />
            {/* 3rd place */}
            {top3[2] ? (
              <PodiumBlock rank={3} profile={top3[2]} pieces={tab === 'monthly' ? top3[2].monthly_pieces : top3[2].lifetime_pieces} />
            ) : (
              <PodiumBlock rank={3} profile={null} pieces={0} />
            )}
          </div>
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Rankings</h3>
          </div>
          <div className="divide-y divide-white/5">
            {rest.map((p, idx) => {
              const pieces = tab === 'monthly' ? p.monthly_pieces : p.lifetime_pieces;
              const level = getLevel(p.lifetime_pieces);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors"
                >
                  <div className="w-6 text-center text-white/30 font-bold text-sm">#{idx + 4}</div>
                  <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                    {p.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">{p.full_name}</div>
                    <div className="text-xs mt-0.5" style={{ color: level.current.color }}>
                      {level.current.icon} {level.current.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">{pieces.toLocaleString()}</div>
                    <div className="text-white/30 text-xs">pieces</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trophy Case */}
      {trophyHistory.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold-500" />
            Trophy Case — Hall of Fame
          </h3>
          <div className="space-y-2">
            {trophyHistory.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-50/30">
                <div className="text-gold-500 font-bold w-16 text-sm flex-shrink-0">
                  {MONTH_NAMES[(t.month || 1) - 1]} {t.year}
                </div>
                <div className="flex-1 text-white/70 text-sm truncate">
                  {(t as any).profile?.full_name || 'Unknown'}
                </div>
                <div className="font-bold text-white text-sm">{t.pieces}p</div>
                {t.rank === 1 && <Crown className="w-4 h-4 text-gold-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeList.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No data yet. Start selling to appear here!</p>
        </div>
      )}
    </div>
  );
}
