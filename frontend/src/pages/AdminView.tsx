import React, { useEffect, useRef, useState } from 'react';
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

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);
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

  // ── Estado de servicios ───────────────────────────────────
  const [apiStatus, setApiStatus] = useState<SvcState>('checking');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiUptime, setApiUptime] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<SvcState>('checking');
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [mqttStatus, setMqttStatus] = useState<SvcState>('checking');
  const [mqttLatency, setMqttLatency] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mqttTimer = useRef<number | null>(null);

  // ── Tester de ingesta ─────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [devEui, setDevEui] = useState('0011223344556601');
  const [format, setFormat] = useState<'chirpstack' | 'simple'>('chirpstack');
  const [humidity, setHumidity] = useState('62.4');
  const [neutrons, setNeutrons] = useState('');
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

  const handleDeleteUser = async (u: PlatformUser) => {
    if (u.email === currentUser?.email) {
      setNotice(t('cannot_delete_self'));
      return;
    }
    if (!confirm(`${t('confirm_delete_user')} "${u.email}"?`)) return;
    try {
      await apiClient.delete(`/users/${u.id}`);
      setNotice(t('user_deleted'));
      await loadUsers();
    } catch (err: any) {
      setNotice(err?.response?.data?.message || t('test_error'));
    }
  };

  const neutronValue = neutrons.trim() === '' ? undefined : num(neutrons, 0);

  const buildPayload = () => {
    if (format === 'simple') {
      return {
        devEui: devEui.trim().toUpperCase(),
        humidity: num(humidity, 0),
        // Si se informa N_raw, el backend calcula θ con el modelo Geant4
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
        humidity: num(humidity, 0),
        // Si se informa N_raw, el backend calcula θ con el modelo Geant4
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

  // ── Checks de servicios ───────────────────────────────────
  const checkApi = async () => {
    setApiStatus('checking');
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/health`);
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

  const checkMqtt = () => {
    setMqttStatus('checking');
    setMqttLatency(null);
    try {
      if (mqttTimer.current) window.clearTimeout(mqttTimer.current);
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      const t0 = performance.now();
      const ws = new WebSocket(`ws://${window.location.hostname}:9001`);
      wsRef.current = ws;
      mqttTimer.current = window.setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        setMqttStatus((s) => (s === 'checking' ? 'offline' : s));
      }, 6000);
      ws.onopen = () => {
        setMqttLatency(Math.round(performance.now() - t0));
        setMqttStatus('online');
        if (mqttTimer.current) window.clearTimeout(mqttTimer.current);
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
      ws.onerror = () => {
        if (mqttTimer.current) window.clearTimeout(mqttTimer.current);
        setMqttStatus('offline');
      };
    } catch {
      setMqttStatus('offline');
    }
  };

  const checkServices = () => {
    checkApi();
    checkDb();
    checkMqtt();
  };

  useEffect(() => {
    loadUsers();
    checkServices();
    return () => {
      if (mqttTimer.current) window.clearTimeout(mqttTimer.current);
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
    };
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
            detail={`ws://${window.location.hostname}:9001`}
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
                            onClick={() => handleDeleteUser(u)}
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
                <label className={labelCls(isDark)}>{t('soil_moisture')} (%)</label>
                <input type="number" step="any" value={humidity} onChange={(e) => setHumidity(e.target.value)} className={inputCls(isDark)} />
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
                <label className={labelCls(isDark)}>{t('neutron_label')} ({t('neutron_unit')})</label>
                <input
                  type="number"
                  step="any"
                  value={neutrons}
                  onChange={(e) => setNeutrons(e.target.value)}
                  placeholder="—"
                  className={inputCls(isDark)}
                />
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
    </div>
  );
};

export default AdminView;
