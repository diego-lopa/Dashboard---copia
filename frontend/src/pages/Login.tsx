import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Lock, Mail, ArrowRight, Shield, Sun, Moon, Languages, ChevronDown } from 'lucide-react';
import { Logo } from '../components/layout/Logo';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage, languages, currentLanguage } = useLanguage();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      login(res.data.accessToken, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifique credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#0B1120]' : 'bg-slate-100'
      }`}
    >
      {/* Ambient glow decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />

      {/* Theme & Language toggle — top right corner */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {/* Theme toggle */}
        <button
          id="login-btn-theme"
          onClick={toggleTheme}
          title={isDark ? t('theme_light') : t('theme_dark')}
          className={`p-2 rounded-lg text-sm transition border ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Language selector */}
        <div className="relative">
          <button
            id="login-btn-lang"
            onClick={() => setLangOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm transition border ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-sm'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>{currentLanguage.nativeName}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>

          {langOpen && (
            <div
              className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl shadow-2xl z-50 overflow-hidden border ${
                isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="p-1.5">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    id={`login-lang-${lang.code}`}
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
                        ? 'text-slate-300 hover:bg-white/5'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Login card ── */}
      <div
        className={`w-full max-w-md rounded-3xl p-8 shadow-2xl relative z-10 border transition-colors duration-300 ${
          isDark
            ? 'glass-panel border-white/[0.08] shadow-black/50'
            : 'bg-white/90 backdrop-blur border-slate-200 shadow-slate-300/40'
        }`}
      >
        {/* Header: logo + CORNEA + Neutron Insights */}
        <div className="text-center mb-8">
          <Logo size="lg" className="mx-auto mb-4" />
          <h1
            className={`text-3xl font-extrabold tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            CORNEA
          </h1>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {t('subtitle')}
          </p>
          <p className={`text-[11px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('developed_by')}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
            <span className="font-bold mt-0.5">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {t('email_label')}
            </label>
            <div className="relative">
              <Mail
                className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                type="email"
                required
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm transition border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isDark
                    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-600 focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] font-bold uppercase tracking-widest mb-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {t('password_label')}
            </label>
            <div className="relative">
              <Lock
                className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <input
                type="password"
                required
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm transition border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isDark
                    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-600 focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-400'
                }`}
              />
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            <span>{loading ? '...' : t('login_button')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo accounts */}
        <div
          className={`mt-7 pt-5 border-t ${
            isDark ? 'border-white/[0.07]' : 'border-slate-200'
          }`}
        >
          <p
            className={`text-[10px] font-bold uppercase tracking-widest text-center mb-3 ${
              isDark ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {t('demo_access')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="demo-admin"
              type="button"
              onClick={() => handleDemoFill('admin@example.com', 'admin123456')}
              className={`px-3 py-2.5 rounded-xl text-xs text-left transition border ${
                isDark
                  ? 'bg-white/[0.04] hover:bg-emerald-500/10 border-white/[0.07] hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400'
                  : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-200 text-slate-500 hover:text-emerald-700'
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-3 h-3" />
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('admin_role')}</span>
              </div>
              <span className="text-[10px]">admin@example.com</span>
            </button>
            <button
              id="demo-operator"
              type="button"
              onClick={() => handleDemoFill('operator@example.com', 'operator123')}
              className={`px-3 py-2.5 rounded-xl text-xs text-left transition border ${
                isDark
                  ? 'bg-white/[0.04] hover:bg-cyan-500/10 border-white/[0.07] hover:border-cyan-500/30 text-slate-400 hover:text-cyan-400'
                  : 'bg-slate-50 hover:bg-cyan-50 border-slate-200 hover:border-cyan-200 text-slate-500 hover:text-cyan-700'
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-3 h-3" />
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('operator_role')}</span>
              </div>
              <span className="text-[10px]">operator@example.com</span>
            </button>
          </div>
        </div>

        {/* Footer: CORNEA by Neutron Insights */}
        <p
          className={`text-center text-[10px] mt-6 ${
            isDark ? 'text-slate-700' : 'text-slate-400'
          }`}
        >
          {t('copyright')}
        </p>
      </div>
    </div>
  );
};
