import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Device, AlertEvent, TelemetryPoint } from '../types';
import { useRealtime } from '../hooks/useRealtime';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { TelemetryChart } from '../components/charts/TelemetryChart';
import { SensorMap } from '../components/map/SensorMap';
import { Link } from 'react-router-dom';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  BatteryWarning,
  WifiOff,
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { es, enUS } from 'date-fns/locale';
import { batteryPercent, isLowBattery } from '../utils/battery';
import { deviceStatusLabel, severityLabel } from '../utils/labels';
import { normalizeAlertEvent } from '../utils/realtime';
import { formatRelative } from '../utils/dates';

export const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [globalHistory, setGlobalHistory] = useState<TelemetryPoint[]>([]);
  const [globalDeviceId, setGlobalDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // IDs visibles (filtro de sondas) se gestiona en Sensores CORNEA; null = sin preferencia -> todas
  const visibleIds = (() => {
    try {
      const raw = localStorage.getItem('cornea_visible_sensors');
      return raw ? new Set(JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  })() as Set<string> | null;

  const dateLocale = language === 'en' ? enUS : es;

  // Cargar datos iniciales — solo catálogo y alertas; el histórico del gráfico
  // se carga bajo demanda según el sensor visible seleccionado.
  const loadData = async () => {
    try {
      const [devsRes, alertsRes] = await Promise.all([
        apiClient.get('/devices'),
        apiClient.get('/alert-events'),
      ]);
      const devs: Device[] = devsRes.data;
      setDevices(devs);
      setAlerts(alertsRes.data.filter((a: AlertEvent) => a.state === 'triggered'));
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChart = async (deviceId: string) => {
    setChartLoading(true);
    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const historyRes = await apiClient.get(`/devices/${deviceId}/measurements`, {
        params: { from, interval: 'raw' },
      });
      setGlobalHistory(
        Array.isArray(historyRes.data?.data) ? historyRes.data.data : historyRes.data?.data || [],
      );
    } catch (err) {
      console.error('Error cargando histórico del gráfico:', err);
      setGlobalHistory([]);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleDevices = devices.filter((d) => {
    if (!d.enabled) return false;
    if (visibleIds === null) return true;
    return visibleIds.has(d.id);
  });

  const chartDevice = visibleDevices.find((d) => d.id === globalDeviceId) || visibleDevices[0] || null;
  const chartIndex = chartDevice ? visibleDevices.findIndex((d) => d.id === chartDevice.id) : -1;

  // Mantener selección coherente con el filtro de visibilidad
  useEffect(() => {
    if (visibleDevices.length === 0) {
      if (globalDeviceId !== null) setGlobalDeviceId(null);
      setGlobalHistory([]);
      return;
    }
    if (!globalDeviceId || !visibleDevices.some((d) => d.id === globalDeviceId)) {
      const firstId = visibleDevices[0].id;
      setGlobalDeviceId(firstId);
      loadChart(firstId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDevices.map((d) => d.id).join(',')]);

  // Cargar histórico al cambiar de sensor seleccionado (navegación)
  useEffect(() => {
    if (globalDeviceId && visibleDevices.some((d) => d.id === globalDeviceId)) {
      loadChart(globalDeviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalDeviceId]);

  // Suscripción a eventos SSE en tiempo real
  useRealtime((event) => {
    if (event.type === 'measurement') {
      setDevices((prevDevices) =>
        prevDevices.map((dev) => {
          if (dev.id === event.deviceId || dev.dev_eui === event.devEui) {
            return {
              ...dev,
              latest_humidity: event.data.humidity ?? dev.latest_humidity,
              latest_temperature: event.data.temperature ?? dev.latest_temperature,
              latest_battery: event.data.battery ?? dev.latest_battery,
              latest_rssi: event.data.rssi ?? dev.latest_rssi,
              latest_snr: event.data.snr ?? dev.latest_snr,
              latest_neutron_counts: event.data.neutron_counts ?? dev.latest_neutron_counts,
              last_seen_at: event.data.timestamp || new Date().toISOString(),
              status: 'online',
            };
          }
          return dev;
        }),
      );
    } else if (event.type === 'alert') {
      if (event.data.state === 'triggered') {
        // El SSE llega en camelCase: normalizar a AlertEvent antes de guardarlo
        const normalized = normalizeAlertEvent(event.data, event.ts);
        setAlerts((prev) => [normalized, ...prev.filter((a) => a.id !== normalized.id)]);
      } else if (event.data.state === 'resolved') {
        setAlerts((prev) => prev.filter((a) => a.id !== event.data.id));
      }
    } else if (event.type === 'device_status') {
      setDevices((prevDevices) =>
        prevDevices.map((dev) =>
          dev.id === event.deviceId ? { ...dev, status: 'offline' } : dev,
        ),
      );
    }
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      await apiClient.post(`/alert-events/${alertId}/acknowledge`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Error al reconocer alerta:', err);
    }
  };

  // KPIs
  const totalSensors = devices.length;
  const onlineSensors = devices.filter((d) => d.status === 'online').length;
  const warningSensors = devices.filter((d) => d.status === 'warning' || d.status === 'critical').length;
  const lowBatterySensors = devices.filter((d) =>
    isLowBattery(d.latest_battery, d.battery_threshold),
  ).length;
  const offlineSensors = devices.filter((d) => d.status === 'offline').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('dashboard_title')}
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('dashboard_subtitle')}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sensores */}
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('total_sensors')}
            </p>
            <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalSensors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        {/* Sensores Online */}
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('online')}
            </p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{onlineSensors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Sensores en Alerta */}
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('in_alert')}
            </p>
            <p className="text-2xl font-bold text-rose-400 mt-1">{warningSensors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Batería Baja */}
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('low_battery')}
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{lowBatterySensors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <BatteryWarning className="w-5 h-5" />
          </div>
        </div>

        {/* Sensores Offline */}
        <div className="glass-card p-4 rounded-2xl border flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('offline')}
            </p>
            <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{offlineSensors}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
            <WifiOff className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Alerts Banner if any */}
      {alerts.length > 0 && (
        <div className={`glass-panel p-5 rounded-2xl border space-y-3 ${isDark ? 'border-rose-500/30 bg-rose-950/10' : 'border-rose-300 bg-rose-50/80'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-rose-500 font-semibold text-sm">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>{t('active_incidents')} ({alerts.length})</span>
            </div>
            <Link to="/alerts" className="text-xs text-rose-500 hover:underline">
              {t('view_all_rules')} →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.slice(0, 4).map((al) => (
              <div
                key={al.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-900/90 border-rose-500/20' : 'bg-white border-rose-200 shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{al.device_name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold whitespace-nowrap bg-rose-500/20 text-rose-500">
                      {severityLabel(al.severity, t)}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{al.message}</p>
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    <Clock className="w-3 h-3" />
                    {formatRelative(al.triggered_at, { addSuffix: true, locale: dateLocale })}
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledge(al.id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 text-xs font-medium border border-rose-500/30 flex items-center gap-1 transition"
                  title={t('ack_alert')}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('ack')}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Charts & Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Historical Telemetry Chart — navegable solo entre sensores visibles */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('chart_title_olivos')}
              </h3>
              <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                {chartDevice ? `${chartDevice.name}` : t('chart_subtitle_olivos')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {visibleDevices.length > 1 && chartDevice && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const prev = chartIndex <= 0 ? visibleDevices.length - 1 : chartIndex - 1;
                      setGlobalDeviceId(visibleDevices[prev].id);
                    }}
                    aria-label="Anterior"
                    className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className={`text-[11px] font-mono min-w-[3ch] text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {chartIndex + 1}/{visibleDevices.length}
                  </span>
                  <button
                    onClick={() => {
                      const next = (chartIndex + 1) % visibleDevices.length;
                      setGlobalDeviceId(visibleDevices[next].id);
                    }}
                    aria-label="Siguiente"
                    className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {chartDevice && (
                <Link
                  to={`/devices/${chartDevice.id}`}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1 font-medium whitespace-nowrap"
                >
                  <span>{t('full_detail')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
          {visibleDevices.length === 0 ? (
            <div className={`h-80 flex items-center justify-center rounded-xl border text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              {t('no_visible_sensors')}
            </div>
          ) : chartLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <TelemetryChart
              data={globalHistory}
              interval="raw"
              humidityMin={chartDevice?.humidity_min_threshold || 15}
              humidityMax={chartDevice?.humidity_max_threshold || 85}
              title={chartDevice ? `${t('sensors')} — ${chartDevice.name}` : undefined}
            />
          )}
        </div>

        {/* Mini Geospatial Map */}
        <div className="glass-panel p-5 rounded-2xl border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('geolocation')}</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('probe_positions')}</p>
            </div>
            <Link
              to="/map"
              className="text-xs text-cyan-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>{t('global_map')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <SensorMap devices={visibleDevices} height="300px" />
        </div>
      </div>

      {/* Live Devices Quick Overview */}
      <div className="glass-panel p-5 rounded-2xl border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('live_probe_status')}</h3>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('live_probe_status_sub')}
            </p>
          </div>
          <Link to="/devices" className="text-xs text-emerald-500 hover:underline font-medium">
            {t('manage_sensors')} →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDevices.map((dev) => {
            const humidity = dev.latest_humidity ?? 0;
            const isHigh = humidity >= dev.humidity_max_threshold;
            const isLow = humidity <= dev.humidity_min_threshold;

            return (
              <Link
                key={dev.id}
                to={`/devices/${dev.id}`}
                className="glass-card p-4 rounded-xl border hover:border-emerald-500/40 transition group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className={`font-semibold text-sm transition group-hover:text-emerald-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {dev.name}
                    </h4>
                    <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dev.dev_eui}</span>
                  </div>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                      dev.status === 'online'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : dev.status === 'warning'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : dev.status === 'critical'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-200 text-slate-600 border border-slate-300'
                    }`}
                  >
                    {deviceStatusLabel(dev.status, t)}
                  </span>
                </div>

                {/* Humidity Gauge bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      <Droplet className="w-3.5 h-3.5 text-emerald-500" />
                      {t('soil_moisture')}
                    </span>
                    <span
                      className={`font-bold ${
                        isHigh ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {dev.latest_humidity !== undefined ? `${dev.latest_humidity}%` : '--'}
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isHigh ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, humidity))}%` }}
                    />
                  </div>
                </div>

                {/* Secondary metrics */}
                <div className={`grid grid-cols-3 gap-2 pt-2 border-t text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-700'}`}>
                  <div className="flex items-center space-x-1">
                    <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                    <span>{dev.latest_temperature !== undefined ? `${dev.latest_temperature}°C` : '--'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Battery className="w-3.5 h-3.5 text-purple-500" />
                    <span>
                      {dev.latest_battery !== undefined
                        ? `${dev.latest_battery}V (${batteryPercent(dev.latest_battery)}%)`
                        : '--'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Wifi className="w-3.5 h-3.5 text-cyan-500" />
                    <span>{dev.latest_rssi !== undefined ? `${dev.latest_rssi} dBm` : '--'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

