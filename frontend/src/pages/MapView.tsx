import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Device } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { SensorMap } from '../components/map/SensorMap';
import { Filter, Layers } from 'lucide-react';

export const MapView: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadDevices = async () => {
    try {
      const res = await apiClient.get('/devices');
      setDevices(res.data);
    } catch (err) {
      console.error('Error cargando dispositivos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const groups = Array.from(new Set(devices.map((d) => d.group_name || t('general'))));

  const filteredDevices = devices.filter((d) => {
    const matchesGroup = groupFilter === 'all' || (d.group_name || t('general')) === groupFilter;
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesGroup && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('map_title')}</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('map_subtitle')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{t('all_statuses')}</option>
              <option value="online">{t('online_green')}</option>
              <option value="warning">{t('warning_amber')}</option>
              <option value="offline">{t('offline_gray')}</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Layers className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className={`border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="all">{t('all_sectors')}</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map Card */}
      {loading ? (
        <div className="h-[600px] glass-panel rounded-2xl flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-panel p-2 rounded-3xl border shadow-2xl">
          <SensorMap devices={filteredDevices} height="650px" />
        </div>
      )}
    </div>
  );
};

