import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, FileText, BarChart3, CheckSquare, Settings, LogOut, Trophy, Menu, X, Tv, ChevronRight, Flame, ShieldCheck, Shield, CircleUser as UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getLevel } from '../lib/levels';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
  badge?: number;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingEod, setPendingEod] = useState(0);

  const levelInfo = getLevel(profile?.lifetime_pieces ?? 0);
  const isPrivileged = ['admin', 'hr', 'manager'].includes(profile?.role ?? '');

  useEffect(() => {
    if (!isPrivileged) return;

    async function loadCount() {
      const { count } = await supabase
        .from('eod_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingEod(count ?? 0);
    }

    loadCount();
    const ch = supabase.channel('layout-eod-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports' }, loadCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isPrivileged]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const navItems: NavItem[] = [
    { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/leads', icon: <Users className="w-5 h-5" />, label: 'Leads' },
    { to: '/eod', icon: <FileText className="w-5 h-5" />, label: 'EOD Report' },
    { to: '/leaderboard', icon: <BarChart3 className="w-5 h-5" />, label: 'Leaderboard' },
    { to: '/tasks', icon: <CheckSquare className="w-5 h-5" />, label: 'Tasks' },
    { to: '/profile', icon: <UserCircle className="w-5 h-5" />, label: 'Profile' },
    {
      to: '/hr',
      icon: <Shield className="w-5 h-5" />,
      label: 'HR Portal',
      roles: ['admin', 'hr', 'manager'],
      badge: pendingEod,
    },
    {
      to: '/admin',
      icon: <Settings className="w-5 h-5" />,
      label: 'Admin',
      roles: ['admin', 'manager'],
    },
  ];

  const filteredNav = navItems.filter(
    item => !item.roles || item.roles.includes(profile?.role ?? '')
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center shadow-gold flex-shrink-0">
            <Trophy className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">MJ Sports</div>
            <div className="text-white/30 text-xs">Elite CRM</div>
          </div>
        </div>
      </div>

      {/* Profile mini */}
      {profile && (
        <div className="px-4 py-4 border-b border-white/5">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-surface-50/30 ${profile.sunday_super_streak ? 'sunday-glow' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-gold-500 font-bold text-sm">
                {profile.full_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-medium truncate">{profile.full_name || 'User'}</div>
              <div className="flex items-center gap-1.5">
                {profile.role === 'sales_executive' ? (
                  <span className="text-xs" style={{ color: levelInfo.current.color }}>
                    {levelInfo.current.icon} {levelInfo.current.name}
                  </span>
                ) : (
                  <span className="text-xs text-white/40 capitalize">{profile.role.replace('_', ' ')}</span>
                )}
              </div>
            </div>
            {profile.current_streak > 0 && (
              <div className={`flex items-center gap-0.5 flex-shrink-0 ${profile.streak_frozen ? 'text-blue-400' : 'text-orange-400'}`}>
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{profile.current_streak}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                isActive
                  ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-gold-500' : 'text-white/40 group-hover:text-white/60'}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-dark-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                {isActive && !item.badge && <ChevronRight className="w-3.5 h-3.5 text-gold-500/50" />}
              </>
            )}
          </NavLink>
        ))}

        <NavLink
          to="/tv"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
              isActive
                ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? 'text-gold-500' : 'text-white/40 group-hover:text-white/60'}>
                <Tv className="w-5 h-5" />
              </span>
              <span className="flex-1">TV Mode</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-gold-500/50" />}
            </>
          )}
        </NavLink>
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 w-full transition-all duration-150"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-dark-400 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-60 bg-surface-200 border-r border-white/5 flex-shrink-0">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-surface-200 border-r border-white/5 z-50 lg:hidden">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="lg:hidden flex items-center bg-surface-200 border-b border-white/5 flex-shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(56px + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="flex items-center gap-3 px-4 h-full touch-manipulation"
            style={{ minWidth: 56, minHeight: 56 }}
            aria-label="Open menu"
          >
            {mobileOpen
              ? <X className="w-6 h-6 text-white/70" />
              : <Menu className="w-6 h-6 text-white/70" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Trophy className="w-5 h-5 text-gold-500 flex-shrink-0" />
            <span className="text-white font-bold text-sm truncate">MJ Sports CRM</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
