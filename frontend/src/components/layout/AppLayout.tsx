import React, { useState, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useRealtime } from '../../hooks/useRealtime';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Cpu,
  Map as MapIcon,
  BellRing,
  ShieldCheck,
  X,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const { isConnected } = useRealtime((event) => {
    if (event.type === 'alert') {
      if (event.data.state === 'triggered') {
        setActiveAlertCount((prev) => prev + 1);
      } else if (event.data.state === 'resolved') {
        setActiveAlertCount((prev) => Math.max(0, prev - 1));
      }
    }
  });

  // Called when the user clicks the alert bell icon — resets the badge
  const handleAlertIconClick = useCallback(() => {
    setActiveAlertCount(0);
  }, []);

  const navItems = [
    { to: '/', label: t('dashboard'), icon: LayoutDashboard, end: true },
    { to: '/devices', label: t('sensors'), icon: Cpu, end: false },
    { to: '/map', label: t('map'), icon: MapIcon, end: false },
    { to: '/alerts', label: t('alerts'), icon: BellRing, end: false },
  ];

  if (user?.role === 'admin') {
    navItems.push({ to: '/admin', label: t('admin'), icon: ShieldCheck, end: false });
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark ? 'bg-[#0B1120]' : 'bg-slate-100'
      }`}
    >
      <Navbar
        realtimeConnected={isConnected}
        activeAlertCount={activeAlertCount}
        onAlertIconClick={handleAlertIconClick}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-hidden max-w-7xl mx-auto w-full min-w-0">
          <Outlet />
        </main>
      </div>

      {/* ── Drawer móvil (solo <md): mismas opciones que el panel lateral ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] flex flex-col px-3 py-4 border-r animate-slide-up ${
              isDark ? 'bg-[#0B1120] border-white/[0.07]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between px-2 mb-3">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {t('system_name')}
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className={`p-2 rounded-lg transition ${
                  isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : isDark
                        ? 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div
              className={`mt-auto px-3 pt-4 border-t text-[11px] leading-relaxed ${
                isDark ? 'border-white/[0.07] text-slate-500' : 'border-slate-200 text-slate-500'
              }`}
            >
              <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                {t('network_status')}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
