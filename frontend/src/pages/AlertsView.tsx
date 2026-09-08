import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { AlertRule, AlertEvent, Device } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  Plus,
  Trash2,
  Check,
  X,
  Sliders,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { alertStateLabel, severityLabel } from '../utils/labels';

export const AlertsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'rules'>('events');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Crear Regla
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    deviceId: '',
    metric: 'humidity',
    condition: '>=',
    threshold: 80,
    durationSeconds: 300,
    hysteresis: 3,
    severity: 'warning',
    channels: ['webhook', 'email'],
  });

  const loadData = async () => {
    try {
      const [rulesRes, eventsRes, devsRes] = await Promise.all([
        apiClient.get('/alert-rules'),
        apiClient.get('/alert-events'),
        apiClient.get('/devices'),
      ]);
      setRules(rulesRes.data);
      setEvents(eventsRes.data);
      setDevices(devsRes.data);
    } catch (err) {
      console.error('Error cargando alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcknowledge = async (eventId: string) => {
    try {
      await apiClient.post(`/alert-events/${eventId}/acknowledge`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error reconociendo alerta');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: ruleForm.name,
        deviceId: ruleForm.deviceId ? ruleForm.deviceId : null,
        metric: ruleForm.metric,
        condition: ruleForm.condition,
        threshold: Number(ruleForm.threshold),
        durationSeconds: Number(ruleForm.durationSeconds),
        hysteresis: Number(ruleForm.hysteresis),
        severity: ruleForm.severity,
        channels: ruleForm.channels,
      };

      await apiClient.post('/alert-rules', payload);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error creando regla');
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (confirm(`¿Eliminar la regla "${name}"?`)) {
      try {
        await apiClient.delete(`/alert-rules/${id}`);
        loadData();
      } catch (err: any) {
        alert(err.response?.data?.message || t('error_deleting_rule'));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('alerts_title')}</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('alerts_subtitle')}
          </p>
        </div>

        {/* Tab switcher */}
        <div className={`flex items-center space-x-2 p-1 rounded-2xl border self-start md:self-auto ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'events'
                ? 'bg-emerald-500 text-white shadow'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('tab_incidents')} ({events.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
              activeTab === 'rules'
                ? 'bg-emerald-500 text-white shadow'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('tab_rules')} ({rules.length})</span>
          </button>
        </div>
      </div>

      {/* Tab: Incidentes / Alert Events */}
      {activeTab === 'events' && (
        <div className="glass-panel rounded-2xl border overflow-hidden shadow-xl">
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <h3 className={`font-semibold text-xs uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('incidents_history')}
            </h3>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('realtime_audit')}</span>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              <thead className={`uppercase text-[10px] tracking-wider border-b ${isDark ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                <tr>
                  <th className="py-3 px-4">{t('status')}</th>
                  <th className="py-3 px-4">{t('sensors')}</th>
                  <th className="py-3 px-4">{t('rule_name')}</th>
                  <th className="py-3 px-4">{t('severity_label')}</th>
                  <th className="py-3 px-4">{t('threshold_label')}</th>
                  <th className="py-3 px-4">{t('triggered_at')}</th>
                  <th className="py-3 px-4">{t('resolved_at')}</th>
                  <th className="py-3 px-4">{t('acknowledged_by')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {events.map((ev) => (
                  <tr key={ev.id} className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap ${
                          ev.state === 'triggered'
                            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 animate-pulse'
                            : ev.state === 'acknowledged'
                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        }`}
                      >
                        {alertStateLabel(ev.state, t)}
                      </span>
                    </td>

                    <td className={`py-3 px-4 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ev.device_name}</td>

                    <td className={`py-3 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{ev.rule_name}</td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold whitespace-nowrap ${
                          ev.severity === 'critical'
                            ? 'bg-rose-100 text-rose-700'
                            : ev.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {severityLabel(ev.severity, t)}
                      </span>
                    </td>

                    <td className={`py-3 px-4 font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ev.value}</td>

                    <td className={`py-3 px-4 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {format(new Date(ev.triggered_at), 'dd/MM/yyyy HH:mm:ss')}
                    </td>

                    <td className={`py-3 px-4 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {ev.resolved_at
                        ? format(new Date(ev.resolved_at), 'dd/MM/yyyy HH:mm:ss')
                        : '--'}
                    </td>

                    <td className={`py-3 px-4 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {ev.acknowledged_by_email || (ev.state === 'acknowledged' ? t('operator') : '--')}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {ev.state === 'triggered' && user?.role !== 'viewer' && (
                        <button
                          onClick={() => handleAcknowledge(ev.id)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs font-medium border border-amber-500/30 flex items-center gap-1 transition ml-auto"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('ack')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Reglas de Alerta */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('tab_rules')}</h3>
            {user?.role !== 'viewer' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 text-white font-semibold text-xs flex items-center space-x-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t('create_rule_btn')}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="glass-card p-4 rounded-2xl border space-y-3 relative group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{rule.name}</h4>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {rule.device_name ? `${t('scope_sensor')}: ${rule.device_name}` : t('all_sensors_global')}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      rule.severity === 'critical'
                        ? 'bg-rose-500/20 text-rose-500'
                        : 'bg-amber-500/20 text-amber-500'
                    }`}
                  >
                    {severityLabel(rule.severity, t)}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('condition_label')}:</span>
                    <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {rule.metric} {rule.condition} {rule.threshold}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('hysteresis')}:</span>
                    <span className="text-emerald-500 font-medium">± {rule.hysteresis}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{t('duration_seconds')}:</span>
                    <span className={isDark ? 'text-white' : 'text-slate-900'}>{rule.duration_seconds} s</span>
                  </div>
                </div>

                <div className={`flex items-center justify-between pt-2 border-t text-[11px] ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                  <span>{t('channels_label')}: {Array.isArray(rule.channels) ? rule.channels.join(', ') : 'webhook'}</span>

                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteRule(rule.id, rule.name)}
                      className={`p-1 rounded transition ${isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'}`}
                      title={t('delete_rule_tooltip')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Crear Regla */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-5 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('create_rule_btn')}</h3>
              <button onClick={() => setIsModalOpen(false)} className={`p-1 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('rule_name')}</label>
                <input
                  type="text"
                  required
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder={t('rule_name_placeholder')}
                  className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('scope_sensor')}</label>
                  <select
                    value={ruleForm.deviceId}
                    onChange={(e) => setRuleForm({ ...ruleForm, deviceId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">{t('all_sensors_global')}</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('metric_label')}</label>
                  <select
                    value={ruleForm.metric}
                    onChange={(e) => setRuleForm({ ...ruleForm, metric: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="humidity">{t('soil_moisture')} (%)</option>
                    <option value="temperature">{t('temperature')} (°C)</option>
                    <option value="battery">{t('battery')} (V)</option>
                    <option value="rssi">{t('signal')} (dBm)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('condition_label')}</label>
<select
                    value={ruleForm.condition}
                    onChange={(e) => setRuleForm({ ...ruleForm, condition: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value=">=">{t('condition_gte')}</option>
                    <option value="<=">{t('condition_lte')}</option>
                    <option value=">">{t('condition_gt')}</option>
                    <option value="<">{t('condition_lt')}</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('threshold_label')}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-500 mb-1">{t('hysteresis')} (±)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={ruleForm.hysteresis}
                    onChange={(e) => setRuleForm({ ...ruleForm, hysteresis: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('duration_seconds')}</label>
                  <input
                    type="number"
                    value={ruleForm.durationSeconds}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, durationSeconds: Number(e.target.value) })
                    }
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('severity_label')}</label>
                  <select
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-emerald-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="low">{t('severity_low')}</option>
                    <option value="warning">{t('severity_warning')}</option>
                    <option value="critical">{t('severity_critical')}</option>
                  </select>
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

