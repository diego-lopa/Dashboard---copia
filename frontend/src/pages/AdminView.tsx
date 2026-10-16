import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { Device } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  Users,
  Server,
  Radio,
  Copy,
  Send,
  RefreshCw,
  FlaskConical,
  Database,
  Zap,
  Check,
  Plus,
  Edit2,
  Trash2,
  X,
  Bot,
  Play,
  Pause,
} from 'lucide-react';

interface PlatformUser {
  id: string;
  email: string;
  role: string;
  active?: boolean;
  enabled?: boolean;
  created_at?: string;
}

type SvcState = 'checking' | 'online' | 'offline';

const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/api\/v1\/?$/, '') || '';
// Clave de demo del .env del proyecto (API_KEY_INGEST). Cambiar si se personaliza en el backend.
const DEFAULT_INGEST_KEY = 'secret_ingest_key_for_http_gateways_123456';

const inputCls = (isDark: boolean) =>
  `w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
  }`;

const labelCls = (isDark: boolean) =>
  `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`;

function formatUptime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export const AdminView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ── Usuarios ──────────────────────────────────────────────
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal crear / editar usuario
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'operator', enabled: true });
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<PlatformUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // ── Estado de servicios ───────────────────────────────────
  const [apiStatus, setApiStatus] = useState<SvcState>('checking');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiUptime, setApiUptime] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<SvcState>('checking');
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [mqttStatus, setMqttStatus] = useState<SvcState>('checking');
  const [mqttLatency, setMqttLatency] = useState<number | null>(null);
  const [mqttHost, setMqttHost] = useState<string | null>(null);

  // ── Herramientas de desarrollo (ocultas por defecto tras un único interruptor) ──
  const [showDevTools, setShowDevTools] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devEui, setDevEui] = useState('0011223344556601');
  const [format, setFormat] = useState<'chirpstack' | 'simple'>('chirpstack');
  const [neutrons, setNeutrons] = useState('62');
  const [temperature, setTemperature] = useState('23.1');
  const [battery, setBattery] = useState('3.82');
  const [pressure, setPressure] = useState('1013.2');
  const [latitude, setLatitude] = useState('42.3486');
  const [longitude, setLongitude] = useState('-8.6747');
  const [rssi, setRssi] = useState('-97');
  const [snr, setSnr] = useState('7.5');
  const [apiKey, setApiKey] = useState(DEFAULT_INGEST_KEY);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Simulador gestionable ─────────────────────────────────
  interface SimSensor {
    id: string;
    name: string;
    dev_eui: string;
    base_neutrons: number;
    base_temp: number;
    base_battery: number;
    base_pressure: number;
    latitude?: number | null;
    longitude?: number | null;
    anomaly_mode: 'none' | 'high' | 'low';
    anomaly_every: number;
    humidity_min_threshold: number;
    humidity_max_threshold: number;
    battery_threshold: number;
    enabled: boolean;
    tick?: number;
  }
  const SIM_DEFAULTS = {
    name: '', devEui: '', baseNeutrons: '30', baseTemp: '19', baseBattery: '3.9',
    basePressure: '1012', latitude: '', longitude: '', anomalyMode: 'none',
    anomalyEvery: '20', humidityMin: '15', humidityMax: '85', batteryThreshold: '20',
    enabled: true,
  };
  const [simState, setSimState] = useState({ enabled: false, interval_ms: 30000 });
  const [simIntervalSec, setSimIntervalSec] = useState('30');
  const [simSensors, setSimSensors] = useState<SimSensor[]>([]);
  const [simLoading, setSimLoading] = useState(true);
  const [simSaving, setSimSaving] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simNotice, setSimNotice] = useState<string | null>(null);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [editingSim, setEditingSim] = useState<SimSensor | null>(null);
  const [simForm, setSimForm] = useState({ ...SIM_DEFAULTS });
  const [savingSim, setSavingSim] = useState(false);
  const [simFormError, setSimFormError] = useState<string | null>(null);
  const [deleteSimTarget, setDeleteSimTarget] = useState<SimSensor | null>(null);
  const [deletingSim, setDeletingSim] = useState(false);
  const [deleteSimError, setDeleteSimError] = useState<string | null>(null);

  const loadSim = async () => {
    setSimLoading(true);
    setSimError(null);
    try {
      const [stRes, seRes] = await Promise.all([
        apiClient.get('/sim/state'),
        apiClient.get('/sim/sensors'),
      ]);
      setSimState({ enabled: !!stRes.data?.enabled, interval_ms: Number(stRes.data?.interval_ms) || 30000 });
      setSimIntervalSec(String(Math.round((Number(stRes.data?.interval_ms) || 30000) / 1000)));
      setSimSensors(Array.isArray(seRes.data) ? seRes.data : []);
    } catch (err: any) {
      setSimError(err?.response?.data?.message || t('test_error'));
    } finally {
      setSimLoading(false);
    }
  };

  const handleSimToggle = async () => {
    const next = !simState.enabled;
    setSimSaving(true);
    setSimError(null);
    try {
      const res = await apiClient.put('/sim/state', { enabled: next });
      setSimState({ enabled: !!res.data?.enabled, interval_ms: Number(res.data?.interval_ms) || 30000 });
      setSimNotice(null);
    } catch (err: any) {
      setSimError(err?.response?.data?.message || t('test_error'));
    } finally {
      setSimSaving(false);
    }
  };

  const handleSimIntervalSave = async () => {
    const sec = Math.max(2, Math.round(Number(simIntervalSec) || 30));
    setSimSaving(true);
    setSimError(null);
    try {
      const res = await apiClient.put('/sim/state', { intervalMs: sec * 1000 });
      setSimState({ enabled: !!res.data?.enabled, interval_ms: Number(res.data?.interval_ms) || 30000 });
      setSimIntervalSec(String(sec));
      setSimNotice(t('sim_interval_saved'));
    } catch (err: any) {
      setSimError(err?.response?.data?.message || t('test_error'));
    } finally {
      setSimSaving(false);
    }
  };

  const openCreateSim = () => {
    setEditingSim(null);
    setSimForm({ ...SIM_DEFAULTS });
    setSimFormError(null);
    setIsSimModalOpen(true);
  };

  const openEditSim = (s: SimSensor) => {
    setEditingSim(s);
    setSimForm({
      name: s.name,
      devEui: s.dev_eui,
      baseNeutrons: String(s.base_neutrons ?? 30),
      baseTemp: String(s.base_temp),
      baseBattery: String(s.base_battery),
      basePressure: String(s.base_pressure),
      latitude: s.latitude ?? '' as any,
      longitude: s.longitude ?? '' as any,
      anomalyMode: s.anomaly_mode,
      anomalyEvery: String(s.anomaly_every),
      humidityMin: String(s.humidity_min_threshold),
      humidityMax: String(s.humidity_max_threshold),
      batteryThreshold: String(s.battery_threshold),
      enabled: !!s.enabled,
    });
    setSimFormError(null);
    setIsSimModalOpen(true);
  };

  const simNum = (v: string, fallback: number) => {
    const n = Number(v);
    return String(v).trim() === '' || Number.isNaN(n) ? fallback : n;
  };

  const handleSaveSim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimFormError(null);
    setSavingSim(true);
    try {
      if (editingSim) {
        const payload: any = {
          name: simForm.name.trim(),
          baseNeutrons: simNum(simForm.baseNeutrons, 30),
          baseTemp: simNum(simForm.baseTemp, 19),
          baseBattery: simNum(simForm.baseBattery, 3.9),
          basePressure: simNum(simForm.basePressure, 1012),
          anomalyMode: simForm.anomalyMode,
          anomalyEvery: Math.max(2, Math.round(simNum(simForm.anomalyEvery, 20))),
          humidityMinThreshold: simNum(simForm.humidityMin, 15),
          humidityMaxThreshold: simNum(simForm.humidityMax, 85),
          batteryThreshold: simNum(simForm.batteryThreshold, 20),
          enabled: simForm.enabled,
        };
        if (String(simForm.latitude).trim() !== '') payload.latitude = simNum(String(simForm.latitude), 0);
        if (String(simForm.longitude).trim() !== '') payload.longitude = simNum(String(simForm.longitude), 0);
        await apiClient.patch(`/sim/sensors/${editingSim.id}`, payload);
      } else {
        const payload: any = {
          name: simForm.name.trim(),
          baseNeutrons: simNum(simForm.baseNeutrons, 30),
          baseTemp: simNum(simForm.baseTemp, 19),
          baseBattery: simNum(simForm.baseBattery, 3.9),
          basePressure: simNum(simForm.basePressure, 1012),
          anomalyMode: simForm.anomalyMode,
          anomalyEvery: Math.max(2, Math.round(simNum(simForm.anomalyEvery, 20))),
          humidityMinThreshold: simNum(simForm.humidityMin, 15),
          humidityMaxThreshold: simNum(simForm.humidityMax, 85),
          batteryThreshold: simNum(simForm.batteryThreshold, 20),
          enabled: simForm.enabled,
        };
        if (simForm.devEui.trim() !== '') payload.devEui = simForm.devEui.trim().toUpperCase();
        if (String(simForm.latitude).trim() !== '') payload.latitude = simNum(String(simForm.latitude), 0);
        if (String(simForm.longitude).trim() !== '') payload.longitude = simNum(String(simForm.longitude), 0);
        await apiClient.post('/sim/sensors', payload);
      }
      setIsSimModalOpen(false);
      await loadSim();
    } catch (err: any) {
      setSimFormError(err?.response?.data?.message || t('test_error'));
    } finally {
      setSavingSim(false);
    }
  };

  const handleSimSensorToggle = async (s: SimSensor) => {
    setSimError(null);
    try {
      await apiClient.patch(`/sim/sensors/${s.id}`, { enabled: !s.enabled });
      await loadSim();
    } catch (err: any) {
      setSimError(err?.response?.data?.message || t('test_error'));
    }
  };

  const handleDeleteSim = async () => {
    if (!deleteSimTarget) return;
    setDeletingSim(true);
    setDeleteSimError(null);
    try {
      await apiClient.delete(`/sim/sensors/${deleteSimTarget.id}`);
      setDeleteSimTarget(null);
      await loadSim();
    } catch (err: any) {
      setDeleteSimError(err?.response?.data?.message || t('test_error'));
    } finally {
      setDeletingSim(false);
    }
  };

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return v.trim() === '' || Number.isNaN(n) ? fallback : n;
  };

  const isUserEnabled = (u: PlatformUser) => (u.enabled !== undefined ? u.enabled : u.active !== false);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await apiClient.get('/users');
      setUsers(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err: any) {
      setUsersError(err?.response?.data?.message || t('test_error'));
    } finally {
      setUsersLoading(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ email: '', password: '', role: 'operator', enabled: true });
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const openEditUser = (u: PlatformUser) => {
    setEditingUser(u);
    setUserForm({ email: u.email, password: '', role: u.role, enabled: isUserEnabled(u) });
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setSavingUser(true);
    try {
      if (editingUser) {
        const payload: any = { role: userForm.role, enabled: userForm.enabled };
        if (userForm.password.trim() !== '') payload.password = userForm.password;
        await apiClient.patch(`/users/${editingUser.id}`, payload);
        setNotice(t('user_updated'));
      } else {
        await apiClient.post('/users', {
          email: userForm.email.trim(),
          password: userForm.password,
          role: userForm.role,
          enabled: userForm.enabled,
        });
        setNotice(t('user_created'));
      }
      setIsUserModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setUserFormError(err?.response?.data?.message || t('test_error'));
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    if (deleteUserTarget.email === currentUser?.email) {
      setDeleteUserError(t('cannot_delete_self'));
      return;
    }
    setDeletingUser(true);
    setDeleteUserError(null);
    try {
      await apiClient.delete(`/users/${deleteUserTarget.id}`);
      setDeleteUserTarget(null);
      setNotice(t('user_deleted'));
      await loadUsers();
    } catch (err: any) {
      setDeleteUserError(err?.response?.data?.message || t('test_error'));
    } finally {
      setDeletingUser(false);
    }
  };

  const neutronValue = neutrons.trim() === '' ? undefined : num(neutrons, 0);

  const buildPayload = () => {
    // El tester siempre envía neutrones (N_raw); la humedad la calcula el
    // backend con el modelo Geant4 (corrección barométrica + EMA).
    if (format === 'simple') {
      return {
        devEui: devEui.trim().toUpperCase(),
        ...(neutronValue !== undefined ? { neutron_counts: neutronValue } : {}),
        temperature: num(temperature, 0),
        battery: num(battery, 0),
        pressure: num(pressure, 0),
        latitude: num(latitude, 0),
        longitude: num(longitude, 0),
        rssi: num(rssi, 0),
        snr: num(snr, 0),
        timestamp: new Date().toISOString(),
      };
    }
    return {
      applicationId: '1',
      deviceInfo: {
        tenantId: '1',
        applicationId: '1',
        deviceProfileId: 'profile-soil-moisture',
        deviceName: 'Admin Test Probe',
        devEui: devEui.trim().toLowerCase(),
      },
      time: new Date().toISOString(),
      fCnt: Math.floor(Math.random() * 60000),
      fPort: 2,
      object: {
        ...(neutronValue !== undefined ? { neutron_counts: neutronValue } : {}),
        temperature: num(temperature, 0),
        battery: num(battery, 0),
        pressure: num(pressure, 0),
        latitude: num(latitude, 0),
        longitude: num(longitude, 0),
      },
      rxInfo: [{ gatewayId: 'AABBCCDDEEFF0011', rssi: num(rssi, 0), snr: num(snr, 0) }],
    };
  };

  const payloadPreview = JSON.stringify(buildPayload(), null, 2);

  const buildCurl = () => {
    const safeJson = JSON.stringify(buildPayload()).replace(/'/g, `'\\''`);
    return `curl -X POST "${API_BASE}/api/v1/ingest/gateway" -H "Content-Type: application/json" -H "X-API-Key: ${apiKey || '<API_KEY>'}" -d '${safeJson}'`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCurl());
    } catch {
      const ta = document.createElement('textarea');
      ta.value = buildCurl();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    setResult(null);
    if (!apiKey.trim()) {
      setResult({ ok: false, message: t('api_key_required') });
      return;
    }
    if (neutrons.trim() === '' || Number.isNaN(Number(neutrons))) {
      setResult({ ok: false, message: `${t('neutron_label')} (${t('neutron_unit')}) ${t('required_field')}` });
      return;
    }
    setSending(true);
    try {
      const res = await apiClient.post('/ingest/gateway', buildPayload(), {
        headers: { 'X-API-Key': apiKey.trim() },
      });
      const accepted = res.status === 202 && res.data?.status !== 'rejected';
      setResult({
        ok: accepted,
        message: accepted
          ? `${t('test_accepted')} (${res.data?.timestamp || new Date().toISOString()})`
          : t('test_rejected'),
      });
    } catch (err: any) {
      const status = err?.response?.status;
      setResult({
        ok: false,
        message: status === 401 ? t('api_key_required') : `${t('test_error')}${status ? ` (HTTP ${status})` : ''}`,
      });
    } finally {
      setSending(false);
    }
  };

  // Health relativo: funciona igual en localhost y en devtunnel (https).
  // Si VITE_API_URL es /api/v1 -> /health -> nginx -> backend (fuera de /api).
  // Si es http://host:8000/api/v1 -> http://host:8000/health.
  const healthUrl = API_BASE ? `${API_BASE}/health` : '/health';

  // ── Checks de servicios ───────────────────────────────────
  const checkApi = async () => {
    setApiStatus('checking');
    const t0 = performance.now();
    try {
      const res = await fetch(healthUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiLatency(Math.round(performance.now() - t0));
      setApiUptime(typeof data?.uptime === 'number' ? formatUptime(data.uptime) : null);
      setApiStatus('online');
    } catch {
      setApiStatus('offline');
      setApiLatency(null);
      setApiUptime(null);
    }
  };

  const checkDb = async () => {
    setDbStatus('checking');
    const t0 = performance.now();
    try {
      const res = await apiClient.get('/devices');
      setDbLatency(Math.round(performance.now() - t0));
      setDbStatus('online');
      if (Array.isArray(res.data)) {
        setDevices(res.data);
        if (!devEui && res.data[0]) setDevEui(res.data[0].dev_eui);
      }
    } catch {
      setDbStatus('offline');
      setDbLatency(null);
    }
  };

  // El estado MQTT se comprueba en el backend (TCP directo al broker en la
  // red Docker): fiable desde cualquier navegador, sin depender de
  // WebSockets salientes que cortafuegos o el navegador pueden bloquear.
  const checkMqtt = async () => {
    setMqttStatus('checking');
    setMqttLatency(null);
    const t0 = performance.now();
    try {
      const res = await apiClient.get('/system/mqtt-status');
      if (res.data?.online) {
        setMqttLatency(res.data.latencyMs ?? Math.round(performance.now() - t0));
        setMqttHost(res.data.host || null);
        setMqttStatus('online');
      } else {
        setMqttStatus('offline');
      }
    } catch {
      setMqttStatus('offline');
    }
  };

  const checkServices = () => {
    // Lanzar en paralelo: antes checkApi bloqueaba visualmente a checkDb/checkMqtt
    checkApi();
    // Pequeño desfase para no saturar el navegador con 3 fetches simultáneos exactos
    checkDb();
    setTimeout(checkMqtt, 150);
  };

  useEffect(() => {
    loadUsers();
    checkServices();
    loadSim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const StatusDot: React.FC<{ state: SvcState }> = ({ state }) => (
    <span
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        state === 'online'
          ? 'bg-emerald-400'
          : state === 'offline'
          ? 'bg-rose-500'
          : 'bg-amber-400 animate-pulse'
      }`}
    />
  );

  const SvcRow: React.FC<{
    icon: React.ReactNode;
    name: string;
    state: SvcState;
    detail?: string | null;
    latency?: number | null;
  }> = ({ icon, name, state, detail, latency }) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
        isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
      }`}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{name}</p>
        <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{detail || '—'}</p>
      </div>
      {latency !== null && latency !== undefined && state === 'online' && (
        <span className={`font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {latency} ms
        </span>
      )}
      <span
        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase ${
          state === 'online' ? 'text-emerald-500' : state === 'offline' ? 'text-rose-500' : 'text-amber-500'
        }`}
      >
        <StatusDot state={state} />
        {state === 'online' ? t('status_online') : state === 'offline' ? t('status_offline') : '…'}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('admin_title')}
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {t('admin_subtitle')}
        </p>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs ${
            isDark
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
              : 'bg-cyan-50 border-cyan-200 text-cyan-800'
          }`}
        >
          {notice}
        </div>
      )}

      {/* ── 1. Estado de servicios ── */}
      <div className={`glass-panel p-5 rounded-2xl border ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('server_info_title')}
            </h3>
          </div>
          <button
            onClick={checkServices}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('refresh_status')}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SvcRow
            icon={<Zap className="w-4 h-4 text-emerald-500 shrink-0" />}
            name={t('service_api')}
            state={apiStatus}
            detail={apiUptime ? `uptime ${apiUptime} · ${API_BASE}` : API_BASE}
            latency={apiLatency}
          />
          <SvcRow
            icon={<Database className="w-4 h-4 text-cyan-500 shrink-0" />}
            name={t('db_status')}
            state={dbStatus}
            detail={dbStatus === 'online' ? `${devices.length} ${t('sensors')}` : t('db_status')}
            latency={dbLatency}
          />
          <SvcRow
            icon={<Radio className="w-4 h-4 text-amber-500 shrink-0" />}
            name={t('mqtt_status')}
            state={mqttStatus}
            detail={mqttHost || t('mqtt_status')}
            latency={mqttLatency}
          />
        </div>
      </div>

      {/* ── 2. Usuarios ── */}
      <div className={`glass-panel p-5 rounded-2xl border ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('users_title')}
            </h3>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              ({users.length} {t('accounts_registered')})
            </span>
          </div>
          <button
            onClick={openCreateUser}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('create_user_btn')}</span>
          </button>
        </div>
        {usersLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : usersError ? (
          <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{usersError}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              <thead
                className={`uppercase text-[10px] tracking-wider border-b ${
                  isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <tr>
                  <th className="py-3 px-4">{t('email_label')}</th>
                  <th className="py-3 px-4">{t('role_label')}</th>
                  <th className="py-3 px-4">{t('status_label')}</th>
                  <th className="py-3 px-4">{t('created_at_label')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {users.map((u) => {
                  const isSelf = u.email === currentUser?.email;
                  return (
                    <tr key={u.id} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                      <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {u.email}
                        {isSelf && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 font-bold">
                            YOU
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 capitalize">{u.role}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            isUserEnabled(u)
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                              : 'bg-slate-500/10 text-slate-500 border border-slate-500/30'
                          }`}
                        >
                          {isUserEnabled(u) ? t('active_user') : t('disabled_user')}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {u.created_at ? new Date(u.created_at).toLocaleString() : '--'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditUser(u)}
                            title={t('edit_user')}
                            className={`p-1.5 rounded-lg border transition ${
                              isDark
                                ? 'bg-slate-900 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 border-slate-700'
                                : 'bg-slate-100 hover:bg-cyan-100 text-slate-600 hover:text-cyan-700 border-slate-300'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteUserError(null);
                              setDeleteUserTarget(u);
                            }}
                            title={isSelf ? t('cannot_delete_self') : t('delete_user')}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg border transition ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-slate-500/10 text-slate-500 border-slate-500/20'
                                : isDark
                                ? 'bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700'
                                : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border-slate-300'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Herramientas de desarrollo: un único interruptor muestra/oculta ── */}
      <div className={`glass-panel px-5 py-4 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-cyan-500" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('dev_tools')}
          </h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showDevTools}
          onClick={() => setShowDevTools((v) => !v)}
          className={`relative w-10 h-[22px] rounded-full transition shrink-0 ${
            showDevTools ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
          }`}
        >
          <span
            className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${
              showDevTools ? 'left-[22px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      {showDevTools && (
      <>
      {/* ── 3. Probador de ingesta ── */}
      <div className={`glass-panel p-5 rounded-2xl border ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-4 h-4 text-cyan-500" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('ingest_tester_title')}
          </h3>
        </div>
        <p className={`text-[11px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {t('ingest_tester_sub')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls(isDark)}>{t('dev_eui')}</label>
                <input
                  type="text"
                  value={devEui}
                  onChange={(e) => setDevEui(e.target.value)}
                  placeholder="0011223344556601"
                  list="ingest-deveui-list"
                  className={`${inputCls(isDark)} font-mono`}
                />
                <datalist id="ingest-deveui-list">
                  {devices.map((d) => (
                    <option key={d.id} value={d.dev_eui}>
                      {d.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('payload_format')}</label>
                <select value={format} onChange={(e) => setFormat(e.target.value as 'chirpstack' | 'simple')} className={inputCls(isDark)}>
                  <option value="chirpstack">{t('format_chirpstack')}</option>
                  <option value="simple">{t('format_simple')}</option>
                </select>
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('api_key_label')}</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="X-API-Key"
                  className={`${inputCls(isDark)} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls(isDark)}>{t('neutron_label')} ({t('neutron_unit')})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={neutrons}
                  onChange={(e) => setNeutrons(e.target.value)}
                  placeholder="62"
                  className={inputCls(isDark)}
                />
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('temperature')} (°C)</label>
                <input type="number" step="any" value={temperature} onChange={(e) => setTemperature(e.target.value)} className={inputCls(isDark)} />
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('battery')} (V)</label>
                <input type="number" step="any" value={battery} onChange={(e) => setBattery(e.target.value)} className={inputCls(isDark)} />
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('pressure_label')} (hPa)</label>
                <input type="number" step="any" value={pressure} onChange={(e) => setPressure(e.target.value)} className={inputCls(isDark)} />
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('signal')} RSSI</label>
                <input type="number" step="any" value={rssi} onChange={(e) => setRssi(e.target.value)} className={inputCls(isDark)} />
              </div>
              <div>
                <label className={labelCls(isDark)}>SNR</label>
                <input type="number" step="any" value={snr} onChange={(e) => setSnr(e.target.value)} className={inputCls(isDark)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleCopy}
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('copy_curl')}</span>
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? t('sending') : t('send_test_telemetry')}</span>
              </button>
            </div>

            {result && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  result.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {result.message}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls(isDark)}>{t('payload_preview')}</label>
            <pre
              className={`p-3 rounded-xl border text-[11px] font-mono overflow-auto max-h-[380px] whitespace-pre-wrap ${
                isDark ? 'bg-slate-900 border-slate-700 text-emerald-300' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {payloadPreview}
            </pre>
          </div>
        </div>
      </div>

      {/* ── 4. Simulador de datos de prueba ── */}
      <div className={`glass-panel p-5 rounded-2xl border ${isDark ? 'border-white/[0.07]' : 'border-slate-200'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('sim_manager_title')}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                simState.enabled
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                  : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-200 text-slate-600 border border-slate-300'
              }`}
            >
              {simState.enabled ? t('status_online') : t('status_offline')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {t('sim_interval_label')}
              </label>
              <input
                type="number"
                min={2}
                value={simIntervalSec}
                onChange={(e) => setSimIntervalSec(e.target.value)}
                className={`w-20 px-2 py-1.5 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSimIntervalSave}
                disabled={simSaving}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs transition disabled:opacity-50"
              >
                {t('sim_save_interval')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSimToggle}
              disabled={simSaving}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 ${
                simState.enabled
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-emerald-500 text-white hover:opacity-95 shadow-lg shadow-emerald-500/20'
              }`}
            >
              {simState.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{t('sim_enabled')}</span>
            </button>
            <button
              type="button"
              onClick={openCreateSim}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('sim_add_sensor')}</span>
            </button>
          </div>
        </div>
        <p className={`text-[11px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {t('sim_manager_sub')}
        </p>
        {!simLoading && !simState.enabled && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
            {t('sim_off_hint')}
          </div>
        )}

        {simError && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
            {simError}
          </div>
        )}
        {simNotice && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs">
            {simNotice}
          </div>
        )}

        {simLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : simSensors.length === 0 ? (
          <p className={`text-xs py-6 text-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('sim_no_sensors')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              <thead className={`uppercase text-[10px] tracking-wider border-b ${isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <tr>
                  <th className="py-3 px-4">{t('rule_name')}</th>
                  <th className="py-3 px-4">DevEUI</th>
                  <th className="py-3 px-4">{t('sim_base_neutrons')}</th>
                  <th className="py-3 px-4">{t('sim_anomaly_mode')}</th>
                  <th className="py-3 px-4">{t('sim_enabled_col')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {simSensors.map((s) => (
                  <tr key={s.id} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                    <td className={`py-2.5 px-4 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {s.name}
                      <span className={`block text-[10px] font-mono font-normal ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        {s.tick ?? 0} msgs
                      </span>
                    </td>
                    <td className={`py-2.5 px-4 font-mono text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {s.dev_eui}
                    </td>
                    <td className="py-2.5 px-4 text-indigo-400 font-medium">{Number(s.base_neutrons)}</td>
                    <td className="py-2.5 px-4">
                      {s.anomaly_mode === 'none'
                        ? t('sim_anomaly_none')
                        : s.anomaly_mode === 'high'
                        ? `${t('sim_anomaly_high')} (${s.anomaly_every})`
                        : `${t('sim_anomaly_low')} (${s.anomaly_every})`}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!s.enabled}
                        onClick={() => handleSimSensorToggle(s)}
                        className={`relative w-10 h-[22px] rounded-full transition shrink-0 ${
                          s.enabled ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all ${s.enabled ? 'left-[22px]' : 'left-[3px]'}`} />
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditSim(s)}
                          title={t('edit_user')}
                          className={`p-1.5 rounded-lg border transition ${
                            isDark
                              ? 'bg-slate-900 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 border-slate-700'
                              : 'bg-slate-100 hover:bg-cyan-100 text-slate-600 hover:text-cyan-700 border-slate-300'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteSimError(null);
                            setDeleteSimTarget(s);
                          }}
                          title={t('delete_user')}
                          className={`p-1.5 rounded-lg border transition ${
                            isDark
                              ? 'bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border-slate-700'
                              : 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 border-slate-300'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Modal crear / editar usuario ── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {editingUser ? t('edit_user_title') : t('create_user_title')}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className={`p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {userFormError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className={labelCls(isDark)}>{t('email_label')}</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="tecnico@empresa.com"
                  className={`${inputCls(isDark)} disabled:opacity-50`}
                />
              </div>
              <div>
                <label className={labelCls(isDark)}>{t('password_label')}</label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={6}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUser ? t('password_placeholder_edit') : '••••••••'}
                  className={inputCls(isDark)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls(isDark)}>{t('role_label')}</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className={inputCls(isDark)}
                  >
                    <option value="admin">{t('admin_role')}</option>
                    <option value="operator">{t('operator_role')}</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('status_label')}</label>
                  <select
                    value={userForm.enabled ? 'enabled' : 'disabled'}
                    onChange={(e) => setUserForm({ ...userForm, enabled: e.target.value === 'enabled' })}
                    className={inputCls(isDark)}
                  >
                    <option value="enabled">{t('enabled_label')}</option>
                    <option value="disabled">{t('disabled_user')}</option>
                  </select>
                </div>
              </div>
              <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className={`px-4 py-2 rounded-xl border text-xs font-medium transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? t('update_user_btn') : t('create_user_btn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado de usuario */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('confirm_delete_user')}</h3>
                <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>"{deleteUserTarget.email}"</p>
              </div>
            </div>
            {deleteUserError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {deleteUserError}
              </div>
            )}
            <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className={`px-4 py-2 rounded-xl border text-xs font-medium transition ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingUser ? '…' : t('delete_user')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar sensor virtual */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {editingSim ? t('sim_edit_sensor') : t('sim_new_sensor')}
              </h3>
              <button onClick={() => setIsSimModalOpen(false)} className={`p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {simFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {simFormError}
              </div>
            )}

            <form onSubmit={handleSaveSim} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls(isDark)}>{t('rule_name')}</label>
                  <input
                    type="text" required value={simForm.name}
                    onChange={(e) => setSimForm({ ...simForm, name: e.target.value })}
                    placeholder="CORNEA Demo 01" className={inputCls(isDark)}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls(isDark)}>DevEUI ({t('optional')})</label>
                  <input
                    type="text" value={simForm.devEui} disabled={!!editingSim}
                    onChange={(e) => setSimForm({ ...simForm, devEui: e.target.value })}
                    placeholder={t('dev_eui_placeholder')} className={`${inputCls(isDark)} font-mono disabled:opacity-50`}
                  />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_base_neutrons')}</label>
                  <input type="number" step="any" value={simForm.baseNeutrons} onChange={(e) => setSimForm({ ...simForm, baseNeutrons: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_base_temp')}</label>
                  <input type="number" step="any" value={simForm.baseTemp} onChange={(e) => setSimForm({ ...simForm, baseTemp: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_base_battery')}</label>
                  <input type="number" step="any" value={simForm.baseBattery} onChange={(e) => setSimForm({ ...simForm, baseBattery: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_base_pressure')}</label>
                  <input type="number" step="any" value={simForm.basePressure} onChange={(e) => setSimForm({ ...simForm, basePressure: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('latitude')}</label>
                  <input type="number" step="any" value={simForm.latitude} onChange={(e) => setSimForm({ ...simForm, latitude: e.target.value })} placeholder="42.3486" className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('longitude')}</label>
                  <input type="number" step="any" value={simForm.longitude} onChange={(e) => setSimForm({ ...simForm, longitude: e.target.value })} placeholder="-8.6747" className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_anomaly_mode')}</label>
                  <select value={simForm.anomalyMode} onChange={(e) => setSimForm({ ...simForm, anomalyMode: e.target.value as any })} className={inputCls(isDark)}>
                    <option value="none">{t('sim_anomaly_none')}</option>
                    <option value="high">{t('sim_anomaly_high')}</option>
                    <option value="low">{t('sim_anomaly_low')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_every')}</label>
                  <input type="number" min={2} value={simForm.anomalyEvery} onChange={(e) => setSimForm({ ...simForm, anomalyEvery: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_humidity_min')}</label>
                  <input type="number" step="any" value={simForm.humidityMin} onChange={(e) => setSimForm({ ...simForm, humidityMin: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_humidity_max')}</label>
                  <input type="number" step="any" value={simForm.humidityMax} onChange={(e) => setSimForm({ ...simForm, humidityMax: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div>
                  <label className={labelCls(isDark)}>{t('sim_battery_threshold')}</label>
                  <input type="number" step="any" value={simForm.batteryThreshold} onChange={(e) => setSimForm({ ...simForm, batteryThreshold: e.target.value })} className={inputCls(isDark)} />
                </div>
                <div className="flex items-end pb-2">
                  <label className={`flex items-center gap-2 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
                      type="checkbox" checked={simForm.enabled}
                      onChange={(e) => setSimForm({ ...simForm, enabled: e.target.checked })}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    {t('sim_enabled_col')}
                  </label>
                </div>
              </div>
              <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button" onClick={() => setIsSimModalOpen(false)}
                  className={`px-4 py-2 rounded-xl border text-xs font-medium transition ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit" disabled={savingSim}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSim ? t('update_user_btn') : t('sim_add_sensor')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado de sensor virtual */}
      {deleteSimTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('sim_delete_title')}</h3>
                <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>"{deleteSimTarget.name}"</p>
              </div>
            </div>
            {deleteSimError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                {deleteSimError}
              </div>
            )}
            <div className={`flex items-center justify-end gap-3 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                type="button" onClick={() => setDeleteSimTarget(null)}
                className={`px-4 py-2 rounded-xl border text-xs font-medium transition ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t('cancel')}
              </button>
              <button
                type="button" onClick={handleDeleteSim} disabled={deletingSim}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingSim ? '…' : t('delete_user')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
