import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Device, TelemetryPoint } from '../types';
import { useRealtime } from '../hooks/useRealtime';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { TelemetryChart } from '../components/charts/TelemetryChart';
import {
  ArrowLeft,
  Download,
  Calendar,
  Layers,
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  Radio,
  MapPin,
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';
import { batteryPercent, batteryThresholdUnit } from '../utils/battery';
import { deviceStatusLabel } from '../utils/labels';

export const DeviceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [device, setDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // Time range & Aggregation state
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [interval, setInterval] = useState<string>('15m');
  const [customFrom] = useState<string>('');
  const [customTo] = useState<string>('');

  const loadDevice = async () => {
    try {
      const res = await apiClient.get(`/devices/${id}`);
      setDevice(res.data);
    } catch (err) {
      console.error('Error cargando sensor:', err);
    }
  };

  const loadTelemetry = async () => {
    if (!id) return;
    setChartLoading(true);
    try {
      let fromDate = new Date();
      let toDate = new Date();

      if (timeRange === '1h') {
        fromDate = subHours(new Date(), 1);
      } else if (timeRange === '24h') {
        fromDate = subHours(new Date(), 24);
      } else if (timeRange === '7d') {
        fromDate = subDays(new Date(), 7);
      } else if (timeRange === '30d') {
        fromDate = subDays(new Date(), 30);
      } else if (timeRange === 'custom' && customFrom && customTo) {
        fromDate = new Date(customFrom);
        toDate = new Date(customTo);
      }

      const res = await apiClient.get(`/devices/${id}/measurements`, {
        params: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          interval,
        },
      });

      setTelemetry(res.data.data);
    } catch (err) {
      console.error('Error cargando telemetría:', err);
    } finally {
      setChartLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevice();
  }, [id]);

  useEffect(() => {
    loadTelemetry();
  }, [id, timeRange, interval]);

  // Suscripción a eventos en tiempo real
  useRealtime((event) => {
    if (event.type === 'measurement' && (event.deviceId === id || event.devEui === device?.dev_eui)) {
      setDevice((prev) =>
        prev
          ? {
              ...prev,
              latest_humidity: event.data.humidity ?? prev.latest_humidity,
              latest_temperature: event.data.temperature ?? prev.latest_temperature,
              latest_battery: event.data.battery ?? prev.latest_battery,
              latest_rssi: event.data.rssi ?? prev.latest_rssi,
              latest_snr: event.data.snr ?? prev.latest_snr,
              last_seen_at: event.data.timestamp || new Date().toISOString(),
              status: 'online',
            }
          : null,
      );
    }
  });

  const handleExportCsv = () => {
    let fromDate = new Date();
    let toDate = new Date();

    if (timeRange === '1h') fromDate = subHours(new Date(), 1);
    else if (timeRange === '24h') fromDate = subHours(new Date(), 24);
    else if (timeRange === '7d') fromDate = subDays(new Date(), 7);
    else if (timeRange === '30d') fromDate = subDays(new Date(), 30);
    else if (timeRange === 'custom' && customFrom && customTo) {
      fromDate = new Date(customFrom);
      toDate = new Date(customTo);
    }

    const token = localStorage.getItem('cornea_jwt');
    const exportUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/devices/${id}/export/csv?from=${fromDate.toISOString()}&to=${toDate.toISOString()}&interval=${interval}`;

    fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telemetria_${device?.name.replace(/\s+/g, '_')}_${interval}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => console.error('Error al exportar CSV:', err));
  };

  if (loading || !device) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/devices"
            className={`p-2 rounded-xl border transition ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={t('back_to_list')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{device.name}</h1>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                  device.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : device.status === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : device.status === 'critical'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-200 text-slate-600 border border-slate-300'
                }`}
              >
                {deviceStatusLabel(device.status, t)}
              </span>
            </div>
            <p className={`text-xs font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              DevEUI: {device.dev_eui} &bull; Sector: {device.group_name || t('general')}
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={handleExportCsv}
          className={`px-4 py-2.5 rounded-xl border flex items-center space-x-2 transition self-start md:self-auto text-xs font-medium ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white hover:bg-slate-800'
              : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-100 shadow-sm'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-500" />
          <span>{t('export_csv')}</span>
        </button>
      </div>

      {/* Live Metrics Grid Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Humedad */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('soil_moisture')}</span>
            <Droplet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-500">
            {device.latest_humidity !== undefined ? `${device.latest_humidity}%` : '--'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('threshold_prefix')} {device.humidity_min_threshold}% - {device.humidity_max_threshold}%
          </p>
        </div>

        {/* Temperatura */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('temperature')}</span>
            <Thermometer className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-amber-500">
            {device.latest_temperature !== undefined ? `${device.latest_temperature}°C` : '--'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('integrated_probe')}</p>
        </div>

        {/* Batería */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('battery')}</span>
            <Battery className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-purple-500">
            {device.latest_battery !== undefined
              ? `${batteryPercent(device.latest_battery)}%`
              : '--'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {device.latest_battery !== undefined ? `${device.latest_battery}V · ` : ''}
            {t('alert_at')} {device.battery_threshold}
            {batteryThresholdUnit(device.battery_threshold)}
          </p>
          {device.latest_battery !== undefined && (
            <div className={`w-full h-1.5 rounded-full overflow-hidden mt-1.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{ width: `${batteryPercent(device.latest_battery) ?? 0}%` }}
              />
            </div>
          )}
        </div>

        {/* RSSI & SNR */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('signal')}</span>
            <Wifi className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-xl font-bold text-cyan-500">
            {device.latest_rssi !== undefined ? `${device.latest_rssi} dBm` : '--'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('snr_label')} {device.latest_snr !== undefined ? `${device.latest_snr} dB` : '--'}
          </p>
        </div>

        {/* Gateway */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Gateway</span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <p className={`text-xs font-mono font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {device.latest_gateway || 'GATEWAY_GW01'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('chirpstack_bridge')}</p>
        </div>

        {/* Coordenadas */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('geolocation')}</span>
            <MapPin className="w-4 h-4 text-rose-500" />
          </div>
          <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {device.latitude && device.longitude
              ? `${device.latitude.toFixed(3)}, ${device.longitude.toFixed(3)}`
              : t('fixed_no_gps')}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('agricultural_sector')}</p>
        </div>
      </div>

      {/* Range & Aggregation Controls */}
      <div className="glass-panel p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4">
        {/* Time range pills */}
        <div className={`flex items-center space-x-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
          <Calendar className={`w-3.5 h-3.5 ml-2 mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          {[
            { id: '1h', label: t('range_1h') },
            { id: '24h', label: t('range_24h') },
            { id: '7d', label: t('range_7d') },
            { id: '30d', label: t('range_30d') },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                timeRange === r.id
                  ? 'bg-emerald-500 text-white shadow'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Aggregation interval selector */}
        <div className="flex items-center space-x-2">
          <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('aggregation')}:</span>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className={`border text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option value="raw">{t('raw_points')}</option>
            <option value="1m">{t('interval_1m')}</option>
            <option value="5m">{t('interval_5m')}</option>
            <option value="15m">{t('interval_15m')}</option>
            <option value="1h">{t('interval_1h')}</option>
            <option value="1d">{t('interval_1d')}</option>
          </select>
        </div>
      </div>

      {/* Interactive ECharts Series */}
      <div className="glass-panel p-5 rounded-2xl border">
        {chartLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <TelemetryChart
            data={telemetry}
            interval={interval}
            humidityMin={device.humidity_min_threshold}
            humidityMax={device.humidity_max_threshold}
            title={`${t('sensors')} - ${device.name} (${telemetry.length} muestras)`}
          />
        )}
      </div>

      {/* Historical Records Table */}
      <div className="glass-panel rounded-2xl border overflow-hidden">
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <h3 className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('history_table')} ({telemetry.length} registros)
          </h3>
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('timescaledb_hypertable')}</span>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            <thead className={`sticky top-0 text-[10px] uppercase border-b ${isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              <tr>
                <th className="py-2.5 px-4">{t('date_time_utc')}</th>
                <th className="py-2.5 px-4">{t('soil_moisture')}</th>
                <th className="py-2.5 px-4">{t('temperature')}</th>
                <th className="py-2.5 px-4">{t('battery')}</th>
                <th className="py-2.5 px-4">{t('pressure_label')}</th>
                <th className="py-2.5 px-4">RSSI</th>
                <th className="py-2.5 px-4">{t('samples_label')}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {telemetry.slice(0, 100).map((row, idx) => (
                <tr key={idx} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                  <td className={`py-2 px-4 font-mono text-[11px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {row.bucket || row.time
                      ? format(new Date(row.bucket || row.time || ''), 'yyyy-MM-dd HH:mm:ss')
                      : '--'}
                  </td>
                  <td className="py-2 px-4 text-emerald-500 font-medium">
                    {row.avg_humidity ?? row.humidity ?? '--'}%
                  </td>
                  <td className="py-2 px-4 text-amber-500 font-medium">
                    {row.avg_temperature ?? row.temperature ?? '--'}°C
                  </td>
                  <td className="py-2 px-4 text-purple-500 font-medium">
                    {row.avg_battery ?? row.battery ?? '--'}V
                  </td>
                  <td className={`py-2 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {row.avg_pressure ?? row.pressure ?? '--'} hPa
                  </td>
                  <td className="py-2 px-4 text-cyan-500 font-medium">
                    {row.avg_rssi ?? row.rssi ?? '--'} dBm
                  </td>
                  <td className={`py-2 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{row.samples ?? 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

