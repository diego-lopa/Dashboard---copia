import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Bell,
  LogOut,
  Shield,
  Sun,
  Moon,
  Languages,
  ChevronDown,
  AlertTriangle,
  Menu,
} from 'lucide-react';
import { Logo } from './Logo';

interface NavbarProps {
  realtimeConnected: boolean;
  activeAlertCount: number;
  onAlertIconClick: () => void;
  onMenuClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  realtimeConnected,
  activeAlertCount,
  onAlertIconClick,
  onMenuClick,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage, languages, currentLanguage } = useLanguage();
  const navigate = useNavigate();

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAlertClick = () => {
    onAlertIconClick();
    navigate('/alerts');
  };

  const isDark = theme === 'dark';

  return (
    <header
      className={`h-16 sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between border-b transition-all duration-300 ${
        isDark
          ? 'glass-panel border-white/[0.07]'
          : 'bg-white/90 backdrop-blur border-slate-200 shadow-sm'
      }`}
    >
      {/* ── Brand: CORNEA + Neutron Insights ── */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {/* Hamburger solo en móvil: abre el panel lateral */}
        <button
          onClick={onMenuClick}
          title="Menu"
          aria-label="Menu"
          className={`md:hidden p-2 -ml-1 rounded-lg transition shrink-0 ${
            isDark
              ? 'hover:bg-white/10 text-slate-300 hover:text-white'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>
        {/* Brand logo */}
        <Logo size="sm" />

        <div className="min-w-0">
          {/* CORNEA + badge */}
          <div className="flex items-center space-x-2 flex-wrap">
            <span
              className={`font-extrabold text-lg tracking-tight leading-none ${
                isDark
                  ? 'bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent'
                  : 'text-slate-900'
              }`}
            >
              CORNEA
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              LoRaWAN IoT
            </span>
          </div>

          {/* "by Neutron Insights" subtitle */}
          <p
            className={`text-[11px] leading-none mt-0.5 hidden sm:block ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {t('developed_by')} ·{' '}
            <span className={isDark ? 'text-cyan-400' : 'text-cyan-600'}>Neutron Insights</span>
          </p>
        </div>
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-2">
        {/* Realtime status indicator */}
        <div
          className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
            realtimeConnected
              ? isDark
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : isDark
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={realtimeConnected ? t('realtime_active') : t('reconnecting')}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              realtimeConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <span>{realtimeConnected ? t('realtime_active') : t('reconnecting')}</span>
        </div>

        {/* ── Theme toggle ── */}
        <button
          id="btn-theme-toggle"
          onClick={toggleTheme}
          title={isDark ? t('theme_light') : t('theme_dark')}
          className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-medium ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="hidden lg:inline">{isDark ? t('theme_light') : t('theme_dark')}</span>
        </button>

        {/* ── Language selector dropdown ── */}
        <div className="relative" ref={langRef}>
          <button
            id="btn-lang-selector"
            onClick={() => setLangOpen((o) => !o)}
            title={t('language')}
            className={`p-2 rounded-lg transition flex items-center gap-1.5 text-xs font-medium ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span className="hidden lg:inline">{currentLanguage.nativeName}</span>
            <span className="lg:hidden">{currentLanguage.code.toUpperCase()}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>

          {langOpen && (
            <div
              className={`absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl z-50 overflow-hidden border ${
                isDark
                  ? 'bg-slate-900 border-white/10 shadow-black/50'
                  : 'bg-white border-slate-200 shadow-slate-200/80'
              }`}
            >
              <div className="p-1.5">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    id={`lang-option-${lang.code}`}
                    onClick={() => {
                      setLanguage(lang.code);
                      setLangOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                      language === lang.code
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                          : 'bg-emerald-50 text-emerald-700 font-semibold'
                        : isDark
                        ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                    {language === lang.code && (
                      <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-500 rounded px-1 py-0.5 font-bold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Alert bell: click redirects to /alerts and clears badge ── */}
        <div className="relative">
          <button
            id="btn-alert-bell"
            onClick={handleAlertClick}
            title={activeAlertCount > 0 ? `${activeAlertCount} alertas activas` : t('no_alerts')}
            className={`p-2 rounded-lg transition relative ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
            }`}
          >
            {activeAlertCount > 0 ? (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
            {activeAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-0.5 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-rose-500/50">
                {activeAlertCount > 99 ? '99+' : activeAlertCount}
              </span>
            )}
          </button>
        </div>

        {/* ── User pill + logout ── */}
        <div
          className={`flex items-center space-x-2 pl-2 border-l ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="hidden lg:block text-right">
            <p
              className={`text-xs font-semibold truncate max-w-[140px] ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {user?.email}
            </p>
            <div className="flex items-center justify-end space-x-1">
              <Shield className="w-3 h-3 text-cyan-500" />
              <span className="text-[10px] text-cyan-500 capitalize">{user?.role}</span>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={logout}
            title={t('logout')}
            className={`p-2 rounded-lg transition flex items-center gap-1 ${
              isDark
                ? 'bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/40'
                : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500 border border-slate-200 hover:border-rose-200'
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
