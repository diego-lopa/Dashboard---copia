export type UserRole = 'admin' | 'operator' | 'viewer';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

export interface DeviceEntity {
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
  battery_threshold?: number;
  humidity_min_threshold?: number;
  humidity_max_threshold?: number;
  created_at: string;
  updated_at: string;
  // Campos calculados
  latest_humidity?: number;
  latest_temperature?: number;
  latest_battery?: number;
  latest_rssi?: number;
  latest_snr?: number;
  /** Último recuento bruto de neutrones CRNS (n/s). */
  latest_neutron_counts?: number;
  status?: 'online' | 'warning' | 'critical' | 'offline';
}

export interface MeasurementRecord {
  time: string;
  device_id: string;
  humidity?: number;
  temperature?: number;
  pressure?: number;
  battery?: number;
  latitude?: number;
  longitude?: number;
  rssi?: number;
  snr?: number;
  gateway_id?: string;
  fcnt_up?: number;
  raw_payload?: string;
  valid?: boolean;
  /** Recuento bruto de neutrones del detector CRNS (n/s). */
  neutron_counts?: number;
}

export interface NormalizedUplink {
  devEui: string;
  timestamp?: string;
  humidity?: number;
  temperature?: number;
  pressure?: number;
  battery?: number;
  latitude?: number;
  longitude?: number;
  rssi?: number;
  snr?: number;
  gatewayId?: string;
  fCntUp?: number;
  rawPayload?: string;
  /** Recuento bruto de neutrones del detector CRNS (n/s). Si viene
   * informado, la humedad se calcula con el modelo calibrado Geant4. */
  neutron_counts?: number;
}

export interface RealtimeEventPayload {
  type: 'measurement' | 'alert' | 'device_status';
  deviceId: string;
  devEui?: string;
  ts: string;
  data: any;
}
