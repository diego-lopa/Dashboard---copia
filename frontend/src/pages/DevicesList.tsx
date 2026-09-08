import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Device } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Cpu,
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { formatBattery } from '../utils/battery';
import { deviceStatusLabel } from '../utils/labels';

export const DevicesList: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [devices, setDevices] = useState<Device[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'en' ? enUS : es;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    devEui: '',
    name: '',
    description: '',
    groupName: 'General',
    latitude: '',
    longitude: '',
    humidityMinThreshold: 30,
    humidityMaxThreshold: 80,
    batteryThreshold: 20,
  });

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

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormData({
      devEui: '',
      name: '',
      description: '',
      groupName: 'General',
      latitude: '',
      longitude: '',
      humidityMinThreshold: 30,
      humidityMaxThreshold: 80,
      batteryThreshold: 20,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setFormData({
      devEui: dev.dev_eui,
      name: dev.name,
      description: dev.description || '',
      groupName: dev.group_name || 'General',
      latitude: dev.latitude !== undefined && dev.latitude !== null ? String(dev.latitude) : '',
      longitude: dev.longitude !== undefined && dev.longitude !== null ? String(dev.longitude) : '',
      humidityMinThreshold: dev.humidity_min_threshold || 30,
      humidityMaxThreshold: dev.humidity_max_threshold || 80,
      batteryThreshold: dev.battery_threshold || 20,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        groupName: formData.groupName,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        humidityMinThreshold: Number(formData.humidityMinThreshold),
        humidityMaxThreshold: Number(formData.humidityMaxThreshold),
        batteryThreshold: Number(formData.batteryThreshold),
      };

      if (editingDevice) {
        await apiClient.patch(`/devices/${editingDevice.id}`, payload);
      } else {
        payload.devEui = formData.devEui;
        await apiClient.post('/devices', payload);
      }

      setIsModalOpen(false);
      loadDevices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error guardando dispositivo');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`${t('confirm_delete')} "${name}"?`)) {
      try {
        await apiClient.delete(`/devices/${id}`);
        loadDevices();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Error eliminando dispositivo');
      }
    }
  };

  const groups = Array.from(new Set(devices.map((d) => d.group_name || 'General')));

  const filteredDevices = devices.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.dev_eui.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dev.status === statusFilter;
    const matchesGroup = groupFilter === 'all' || (dev.group_name || 'General') === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('sensors_title')}</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('sensors_subtitle')}
          </p>
        </div>

        {user?.role !== 'viewer' && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 text-white font-semibold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{t('register_sensor_btn')}</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl border flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search_placeholder')}
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 transition ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option value="all">{t('all_statuses')}</option>
            <option value="online">{t('dev_online')}</option>
            <option value="warning">{t('dev_warning')}</option>
            <option value="offline">{t('dev_offline')}</option>
          </select>
        </div>

        {/* Group Filter */}
        <div className="w-full md:w-auto">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className={`w-full border text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option value="all">{t('all_groups')}</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Devices Table */}
      <div className="glass-panel rounded-2xl border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            <thead className={`uppercase text-[10px] tracking-wider border-b ${isDark ? 'bg-slate-900/90 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              <tr>
                <th className="py-3.5 px-4 font-semibold">{t('sensors')} / {t('dev_eui')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('group_sector')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('soil_moisture')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('temperature')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('battery')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('signal')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('last_connection')}</th>
                <th className="py-3.5 px-4 font-semibold">{t('status')}</th>
                <th className="py-3.5 px-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {filteredDevices.map((dev) => {
                const humidity = dev.latest_humidity ?? 0;
                const isHigh = humidity >= dev.humidity_max_threshold;
                const isLow = humidity <= dev.humidity_min_threshold;

                return (
                  <tr key={dev.id} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{dev.name}</p>
                          <p className={`font-mono text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dev.dev_eui}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
                        {dev.group_name || t('general')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <Droplet className="w-3.5 h-3.5 text-emerald-500" />
                        <span
                          className={`font-bold ${
                            isHigh ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500'
                          }`}
                        >
                          {dev.latest_humidity !== undefined ? `${dev.latest_humidity}%` : '--'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-amber-500 font-medium">
                        <Thermometer className="w-3.5 h-3.5" />
                        <span>
                          {dev.latest_temperature !== undefined ? `${dev.latest_temperature}°C` : '--'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-purple-500 font-medium">
                        <Battery className="w-3.5 h-3.5" />
                        <span>{formatBattery(dev.latest_battery)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-cyan-500 font-medium">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>
                          {dev.latest_rssi !== undefined ? `${dev.latest_rssi} dBm` : '--'}
                        </span>
                      </div>
                    </td>

                    <td className={`py-3.5 px-4 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {dev.last_seen_at
                        ? formatDistanceToNow(new Date(dev.last_seen_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : t('never')}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                          dev.status === 'online'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : dev.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : dev.status === 'critical'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {deviceStatusLabel(dev.status, t)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/devices/${dev.id}`}
                          className={`p-1.5 rounded-lg border transition ${
                            isDark
                              ? 'bg-slate-900 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border-slate-700'
                              : 'bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 border-slate-300'
                          }`}
                          title={t('full_detail')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        {user?.role !== 'viewer' && (
                          <button
                            onClick={() => openEditModal(dev)}
                            className={`p-1.5 rounded-lg border transition ${
                              isDark
                                ? 'bg-slate-900 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 border-slate-700'
                                : 'bg-slate-100 hover:bg-cyan-100 text-slate-600 hover:text-cyan-700 border-slate-300'
                            }`}
                            title={t('edit_sensor')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(dev.id, dev.name)}
                            className={`p-1.5 rounded-lg border transition ${
                              isDark
                                ? 'bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700'
                                : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border-slate-300'
                            }`}
                            title={t('delete_sensor')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {editingDevice ? t('edit_sensor') : t('register_sensor_btn')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('dev_eui')} (16 hex)
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDevice}
                    value={formData.devEui}
                    onChange={(e) => setFormData({ ...formData, devEui: e.target.value })}
                    placeholder="0011223344556601"
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('sensor_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Sonda Humedad Sector A"
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t('group_sector')}
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                  placeholder="Finca Norte - Olivos"
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('latitude')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="40.4168"
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('longitude')}</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="-3.7038"
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`grid grid-cols-2 gap-3 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div>
                  <label className="block text-xs font-semibold text-amber-500 mb-1">
                    {t('min_humidity_thresh')}
                  </label>
                  <input
                    type="number"
                    value={formData.humidityMinThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, humidityMinThreshold: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-500 mb-1">
                    {t('max_humidity_thresh')}
                  </label>
                  <input
                    type="number"
                    value={formData.humidityMaxThreshold}
                    onChange={(e) =>
                      setFormData({ ...formData, humidityMaxThreshold: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className={`flex items-center justify-end space-x-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl border text-xs font-medium transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

