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
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  Radio,
  MapPin,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { format, subHours, subDays } from 'date-fns';
import { formatDateTime } from '../utils/dates';
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

  // Time range state (carga bajo demanda al seleccionar rango).
  // Siempre en raw: con cadencia de 30 min, 30 días son 1440 puntos y el
  // backend devuelve como máximo los 5000 más recientes.
  const [timeRange, setTimeRange] = useState<string>('24h');
  const interval = 'raw';

  // Ordenación de la tabla de histórico (solo presentación, no modifica datos).
  // Por defecto: fecha/hora descendente (más recientes arriba).
  type SortKey = 'time' | 'humidity' | 'neutrons' | 'temperature' | 'battery' | 'pressure' | 'rssi' | 'samples';
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const rowValue = (row: TelemetryPoint, key: SortKey): number | string | null => {
    switch (key) {
      case 'time':
        return new Date(row.bucket || row.time || 0).getTime();
      case 'humidity':
        return row.avg_humidity ?? row.humidity ?? null;
      case 'neutrons':
        return row.avg_neutron_counts ?? row.neutron_counts ?? null;
      case 'temperature':
        return row.avg_temperature ?? row.temperature ?? null;
      case 'battery':
        return row.avg_battery ?? row.battery ?? null;
      case 'pressure':
        return row.avg_pressure ?? row.pressure ?? null;
      case 'rssi':
        return row.avg_rssi ?? row.rssi ?? null;
      case 'samples':
        return row.samples ?? 1;
      default:
        return null;
    }
  };

  const sortedTelemetry = [...telemetry].sort((a, b) => {
    const va = rowValue(a, sortKey);
    const vb = rowValue(b, sortKey);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    let cmp = 0;
    if (typeof va === 'string' && typeof vb === 'string') {
      cmp = va.localeCompare(vb);
    } else {
      cmp = Number(va) - Number(vb);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Unidad de presión (hPa/atm): solo presentación, se calcula al hacer clic,
  // no se almacena nada doble en BD. 1 atm = 1013.25 hPa.
  const [pressureUnit, setPressureUnit] = useState<'hPa' | 'atm'>('hPa');
  const fmtPressure = (hpa?: number | null): string => {
    if (hpa === undefined || hpa === null || Number.isNaN(hpa)) return '--';
    return pressureUnit === 'hPa' ? `${hpa} hPa` : `${(hpa / 1013.25).toFixed(4)} atm`;
  };

  const handleRangeChange = (range: string) => {
    setTimeRange(range);
  };

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

      if (timeRange === '8h') {
        fromDate = subHours(new Date(), 8);
      } else if (timeRange === '24h') {
        fromDate = subHours(new Date(), 24);
      } else if (timeRange === '30d') {
        fromDate = subDays(new Date(), 30);
      } else if (timeRange === 'full') {
        fromDate = new Date('2000-01-01T00:00:00Z');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, timeRange]);

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
              latest_pressure: event.data.pressure ?? prev.latest_pressure,
              latest_rssi: event.data.rssi ?? prev.latest_rssi,
              latest_snr: event.data.snr ?? prev.latest_snr,
              latest_neutron_counts: event.data.neutron_counts ?? prev.latest_neutron_counts,
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

    if (timeRange === '8h') fromDate = subHours(new Date(), 8);
    else if (timeRange === '24h') fromDate = subHours(new Date(), 24);
    else if (timeRange === '30d') fromDate = subDays(new Date(), 30);
    else if (timeRange === 'full') fromDate = new Date('2000-01-01T00:00:00Z');

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
              {(device as any).place_name ? ` · ${(device as any).place_name}` : ''}
            </p>
            {(device as any).pressure !== undefined && (device as any).pressure !== null && (
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('pressure_label')}: {(device as any).pressure} hPa
              </p>
            )}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Neutrones CRNS (N_raw) */}
        <div className="glass-card p-3.5 rounded-2xl border bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-900'}`}>
              {t('neutron_label')}
            </span>
            <Zap className="w-4 h-4 text-indigo-400 animate-breathe" />
          </div>
          <p className="text-xl font-bold text-indigo-400">
            {device.latest_neutron_counts !== undefined && device.latest_neutron_counts !== null
              ? `${device.latest_neutron_counts}`
              : '--'}
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-indigo-300/80' : 'text-indigo-700'}`}>
            {t('neutron_unit')} · N₀=143 · Geant4
          </p>
        </div>

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

        {/* Presión (clic en el valor: hPa ⇄ atm, cálculo local sin doble registro) */}
        <div className="glass-card p-3.5 rounded-2xl border">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              {t('pressure_label')}
            </span>
            <span className="px-1.5 rounded-full bg-sky-500/20 text-sky-500 flex items-center justify-center text-[10px] font-bold">
              {pressureUnit}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPressureUnit((u) => (u === 'hPa' ? 'atm' : 'hPa'))}
            title={t('pressure_toggle_hint')}
            className="text-xl font-bold text-sky-500 hover:opacity-80 transition cursor-pointer"
          >
            {device.latest_pressure !== undefined && device.latest_pressure !== null
              ? fmtPressure(device.latest_pressure)
              : (device as any).pressure !== undefined && (device as any).pressure !== null
              ? fmtPressure((device as any).pressure)
              : '--'}
          </button>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('pressure_toggle_hint')}
          </p>
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
            { id: '8h', label: t('range_8h') },
            { id: '24h', label: t('range_24h') },
            { id: '30d', label: t('range_30d') },
            { id: 'full', label: t('range_full') },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => handleRangeChange(r.id)}
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
            title={`${device.name}`}
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
                {[
                  { key: 'time' as SortKey, label: t('date_time_utc') },
                  { key: 'humidity' as SortKey, label: t('soil_moisture') },
                  { key: 'neutrons' as SortKey, label: t('neutrons_col') },
                  { key: 'temperature' as SortKey, label: t('temperature') },
                  { key: 'battery' as SortKey, label: t('battery') },
                  { key: 'pressure' as SortKey, label: t('pressure_label') },
                  { key: 'rssi' as SortKey, label: 'RSSI' },
                  { key: 'samples' as SortKey, label: t('samples_label') },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="py-2.5 px-4 whitespace-nowrap cursor-pointer select-none hover:opacity-80"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {sortedTelemetry.slice(0, 100).map((row, idx) => (
                <tr key={idx} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                  <td className={`py-2 px-4 font-mono text-[11px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatDateTime(row.bucket || row.time || '', 'yyyy-MM-dd HH:mm:ss')}
                  </td>
                  <td className="py-2 px-4 text-emerald-500 font-medium whitespace-nowrap">
                    {row.avg_humidity ?? row.humidity ?? '--'}%
                  </td>
                  <td className="py-2 px-4 text-indigo-400 font-medium whitespace-nowrap">
                    {row.avg_neutron_counts ?? row.neutron_counts ?? '--'}
                  </td>
                  <td className="py-2 px-4 text-amber-500 font-medium whitespace-nowrap">
                    {row.avg_temperature ?? row.temperature ?? '--'}°C
                  </td>
                  <td className="py-2 px-4 text-purple-500 font-medium">
                    {row.avg_battery ?? row.battery ?? '--'}V
                  </td>
                  <td className={`py-2 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <button
                      type="button"
                      onClick={() => setPressureUnit((u) => (u === 'hPa' ? 'atm' : 'hPa'))}
                      title={t('pressure_toggle_hint')}
                      className="hover:opacity-80 transition cursor-pointer whitespace-nowrap"
                    >
                      {fmtPressure(row.avg_pressure ?? row.pressure)}
                    </button>
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

