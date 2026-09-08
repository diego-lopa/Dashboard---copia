export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  tenantId: string;
  tenantName?: string;
  email: string;
  role: UserRole;
}

export interface Device {
  id: string;
  tenant_id: string;
  dev_eui: string;
  name: string;
  description?: string;
  group_name?: string;
  latitude?: number;
  longitude?: number;
  enabled: boolean;
  last_seen_at?: string;
  battery_threshold: number;
  humidity_min_threshold: number;
  humidity_max_threshold: number;
  latest_humidity?: number;
  latest_temperature?: number;
  latest_pressure?: number;
  latest_battery?: number;
  latest_rssi?: number;
  latest_snr?: number;
  latest_gateway?: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  active_alerts?: number;
}

export interface TelemetryPoint {
  time?: string;
  bucket?: string;
  humidity?: number;
  temperature?: number;
  pressure?: number;
  battery?: number;
  rssi?: number;
  snr?: number;
  avg_humidity?: number;
  min_humidity?: number;
  max_humidity?: number;
  avg_temperature?: number;
  min_temperature?: number;
  max_temperature?: number;
  avg_battery?: number;
  avg_pressure?: number;
  avg_rssi?: number;
  samples?: number;
}

export interface AlertRule {
  id: string;
  tenant_id: string;
  device_id?: string;
  device_name?: string;
  dev_eui?: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  duration_seconds: number;
  hysteresis: number;
  severity: 'low' | 'warning' | 'critical';
  enabled: boolean;
  channels: string[];
  created_at: string;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  rule_name: string;
  metric: string;
  condition: string;
  threshold: number;
  device_id: string;
  device_name: string;
  dev_eui: string;
  state: 'triggered' | 'acknowledged' | 'resolved';
  severity: string;
  value: number;
  message: string;
  triggered_at: string;
  resolved_at?: string;
  acknowledged_at?: string;
  acknowledged_by_email?: string;
}

export interface RealtimeEvent {
  type: 'measurement' | 'alert' | 'device_status';
  deviceId: string;
  devEui?: string;
  ts: string;
  data: any;
}
