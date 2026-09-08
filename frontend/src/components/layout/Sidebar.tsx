import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Cpu, Map as MapIcon, BellRing, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';

export const Sidebar: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const items = [
    { to: '/', label: t('dashboard'), icon: LayoutDashboard, end: true },
    { to: '/devices', label: t('sensors'), icon: Cpu, end: false },
    { to: '/map', label: t('map'), icon: MapIcon, end: false },
    { to: '/alerts', label: t('alerts'), icon: BellRing, end: false },
  ];

  if (user?.role === 'admin') {
    items.push({ to: '/admin', label: t('admin'), icon: ShieldCheck, end: false });
  }

  return (
    <aside
      className={`hidden md:flex w-60 shrink-0 flex-col border-r px-3 py-4 transition-colors duration-300 ${
        isDark
          ? 'bg-[#0B1120] border-white/[0.07]'
          : 'bg-white border-slate-200'
      }`}
    >
      <p
        className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-widest ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}
      >
        {t('system_name')}
      </p>
      <nav className="space-y-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
        <p className="mt-0.5">{t('developed_by')}</p>
      </div>
    </aside>
  );
};

export default Sidebar;
