import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { DatabaseService } from '../../database/database.service';
import { CreateSimSensorDto, UpdateSimSensorDto, UpdateSimStateDto } from './dto/sim.dto';

const CONTROL_POLL_MS = 5000;
const MIN_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 3600000;

// Bandas de N_raw calibradas con cornea_pipeline/config/calibration_config.json
// (N0=143, P0=981.4, L=137). La app traduce N → θ con Geant4:
//   N 8-10   → θ 86-88 % → aviso  (regla humidity >= 85)
//   N 102-110 → θ 12-14 % → alarma (regla humidity <= 15)
//   N 15-60   → θ 30-72 % → normal (nunca dispara)
// Ojo: humedad alta ⇔ conteo BAJO (los neutrones se absorben en el agua).
const N_WET = [8, 10];
const N_DRY = [102, 110];
const N_NORMAL = [15, 60];

/** Gaussiana estándar (Box-Muller) para ruido Poisson ~ sqrt(N). */
function gauss(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Simulador gestionable desde el panel admin. Los perfiles viven en
 * `sim_sensors` y el interruptor+frecuencia en `sim_state` (por tenant).
 * El bucle de emisión corre SOLO en el worker (mismo criterio que la
 * suscripción MQTT: si la API también emitiese, todo llegaría duplicado).
 *
 * MODELO FÍSICO: cada uplink es un evento ChirpStack v4 real que lleva
 * ÚNICAMENTE el recuento bruto de neutrones (N_raw) + entorno; la humedad la
 * calcula el backend con el modelo Geant4 calibrado a partir de N y la presión
 * de esa sonda. Igual que el hardware: la sonda no conoce su humedad.
 */
@Injectable()
export class SimService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimService.name);
  private client: mqtt.MqttClient | null = null;
  private timer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (this.configService.get<boolean>('mqtt.subscribe') === false) {
      return; // Proceso API: solo CRUD, sin bucle de emisión.
    }
    this.logger.log('Simulador gestionable: bucle de emisión armado (worker).');
    this.schedule(3000);
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.client) this.client.end(true);
  }

  // ── Estado ────────────────────────────────────────────────
  async getState(tenantId: string) {
    const res = await this.db.query('SELECT * FROM sim_state WHERE tenant_id = $1', [tenantId]);
    return (
      res.rows[0] ?? { tenant_id: tenantId, enabled: false, interval_ms: 30000, updated_at: null }
    );
  }

  async updateState(tenantId: string, dto: UpdateSimStateDto) {
    const interval = dto.intervalMs !== undefined ? clamp(dto.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS) : undefined;
    const res = await this.db.query(
      `INSERT INTO sim_state (tenant_id, enabled, interval_ms, updated_at)
       VALUES ($1, COALESCE($2, false), COALESCE($3, 30000), now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         enabled = COALESCE($2, sim_state.enabled),
         interval_ms = COALESCE($3, sim_state.interval_ms),
         updated_at = now()
       RETURNING *;`,
      [tenantId, dto.enabled ?? null, interval ?? null],
    );
    return res.rows[0];
  }

  // ── Sensores virtuales ────────────────────────────────────
  async listSensors(tenantId: string) {
    const res = await this.db.query(
      'SELECT * FROM sim_sensors WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId],
    );
    return res.rows;
  }

  async createSensor(tenantId: string, dto: CreateSimSensorDto) {
    const devEui = await this.resolveDevEui((dto.devEui || '').trim().toUpperCase());
    try {
      const res = await this.db.query(
        `INSERT INTO sim_sensors (
           tenant_id, name, dev_eui, base_neutrons, base_temp, base_battery, base_pressure,
           latitude, longitude, anomaly_mode, anomaly_every,
           humidity_min_threshold, humidity_max_threshold, battery_threshold, enabled
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *;`,
        [
          tenantId,
          dto.name.trim(),
          devEui,
          dto.baseNeutrons ?? 30.0,
          dto.baseTemp ?? 19.0,
          dto.baseBattery ?? 3.9,
          dto.basePressure ?? 1012.0,
          dto.latitude ?? null,
          dto.longitude ?? null,
          dto.anomalyMode ?? 'none',
          dto.anomalyEvery ?? 20,
          dto.humidityMinThreshold ?? 15.0,
          dto.humidityMaxThreshold ?? 85.0,
          dto.batteryThreshold ?? 20.0,
          dto.enabled ?? true,
        ],
      );
      await this.syncDeviceThresholds(tenantId, res.rows[0]);
      return res.rows[0];
    } catch (err) {
      if (err?.code === '23505') throw new ConflictException(`El DevEUI ${devEui} ya existe`);
      throw err;
    }
  }

  async updateSensor(id: string, tenantId: string, dto: UpdateSimSensorDto) {
    const cur = await this.db.query('SELECT * FROM sim_sensors WHERE id = $1 AND tenant_id = $2', [
      id,
      tenantId,
    ]);
    if (cur.rows.length === 0) throw new NotFoundException('Sensor virtual no encontrado');
    const prev = cur.rows[0];
    const next = {
      name: dto.name?.trim() || prev.name,
      base_neutrons: dto.baseNeutrons ?? Number(prev.base_neutrons ?? 30),
      base_temp: dto.baseTemp ?? Number(prev.base_temp),
      base_battery: dto.baseBattery ?? Number(prev.base_battery),
      base_pressure: dto.basePressure ?? Number(prev.base_pressure),
      latitude: dto.latitude ?? prev.latitude,
      longitude: dto.longitude ?? prev.longitude,
      anomaly_mode: dto.anomalyMode ?? prev.anomaly_mode,
      anomaly_every: dto.anomalyEvery ?? Number(prev.anomaly_every),
      humidity_min_threshold: dto.humidityMinThreshold ?? Number(prev.humidity_min_threshold),
      humidity_max_threshold: dto.humidityMaxThreshold ?? Number(prev.humidity_max_threshold),
      battery_threshold: dto.batteryThreshold ?? Number(prev.battery_threshold),
      enabled: dto.enabled ?? prev.enabled,
    };
    const res = await this.db.query(
      `UPDATE sim_sensors SET name=$3, base_neutrons=$4, base_temp=$5, base_battery=$6,
        base_pressure=$7, latitude=$8, longitude=$9, anomaly_mode=$10, anomaly_every=$11,
        humidity_min_threshold=$12, humidity_max_threshold=$13, battery_threshold=$14,
        enabled=$15, updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING *;`,
      [
        id,
        tenantId,
        next.name,
        next.base_neutrons,
        next.base_temp,
        next.base_battery,
        next.base_pressure,
        next.latitude,
        next.longitude,
        next.anomaly_mode,
        next.anomaly_every,
        next.humidity_min_threshold,
        next.humidity_max_threshold,
        next.battery_threshold,
        next.enabled,
      ],
    );
    await this.syncDeviceThresholds(tenantId, res.rows[0]);
    return res.rows[0];
  }

  async deleteSensor(id: string, tenantId: string) {
    const res = await this.db.query(
      'DELETE FROM sim_sensors WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId],
    );
    if (res.rows.length === 0) throw new NotFoundException('Sensor virtual no encontrado');
    return { success: true };
  }

  /** Propaga los umbrales del perfil al dispositivo real si ya existe. */
  private async syncDeviceThresholds(tenantId: string, sim: any) {
    await this.db.query(
      `UPDATE devices SET humidity_min_threshold = $3, humidity_max_threshold = $4,
        battery_threshold = $5, updated_at = now()
       WHERE tenant_id = $1 AND dev_eui = $2;`,
      [
        tenantId,
        sim.dev_eui,
        Number(sim.humidity_min_threshold),
        Number(sim.humidity_max_threshold),
        Number(sim.battery_threshold),
      ],
    );
  }

  private async resolveDevEui(candidate: string): Promise<string> {
    if (candidate) {
      const dup = await this.db.query(
        'SELECT id FROM sim_sensors WHERE dev_eui = $1 UNION SELECT id FROM devices WHERE dev_eui = $1 LIMIT 1',
        [candidate],
      );
      if (dup.rows.length > 0) throw new ConflictException(`El DevEUI ${candidate} ya existe`);
      return candidate;
    }
    const { randomBytes } = await import('crypto');
    for (let i = 0; i < 5; i++) {
      const gen = randomBytes(8).toString('hex').toUpperCase();
      const dup = await this.db.query(
        'SELECT id FROM sim_sensors WHERE dev_eui = $1 UNION SELECT id FROM devices WHERE dev_eui = $1 LIMIT 1',
        [gen],
      );
      if (dup.rows.length === 0) return gen;
    }
    throw new ConflictException('No se pudo generar un DevEUI único, reintenta');
  }

  // ── Bucle de emisión (solo worker) ────────────────────────
  private schedule(delayMs: number) {
    if (this.destroyed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cycle().catch((e) => this.logger.error(e?.message)), delayMs);
  }

  private async cycle() {
    if (this.destroyed) return;
    try {
      const states = await this.db.query('SELECT * FROM sim_state WHERE enabled = true');
      if (states.rows.length === 0) {
        this.schedule(CONTROL_POLL_MS);
        return;
      }
      this.ensureClient();
      for (const st of states.rows) {
        const sensors = await this.db.query(
          'SELECT * FROM sim_sensors WHERE tenant_id = $1 AND enabled = true ORDER BY name ASC',
          [st.tenant_id],
        );
        for (const s of sensors.rows) {
          await this.emit(s);
        }
      }
      // La frecuencia puede variar por tenant: reprogramar con el mínimo
      // activo para no perder resolución en ninguno.
      const minInterval = states.rows.reduce(
        (m: number, st: any) => Math.min(m, clamp(Number(st.interval_ms) || 30000, MIN_INTERVAL_MS, MAX_INTERVAL_MS)),
        MAX_INTERVAL_MS,
      );
      this.schedule(minInterval);
    } catch (err) {
      this.logger.error(`Ciclo del simulador: ${err?.message}`);
      this.schedule(15000);
    }
  }

  private ensureClient() {
    if (this.client) return;
    const url = this.configService.get<string>('mqtt.url');
    this.client = mqtt.connect(url, {
      username: this.configService.get<string>('mqtt.username'),
      password: this.configService.get<string>('mqtt.password'),
      clientId: `cornea_sim_mgr_${Math.random().toString(16).substring(2, 8)}`,
      reconnectPeriod: 5000,
    });
    this.client.on('connect', () => this.logger.log('Simulador gestionable conectado a MQTT'));
    this.client.on('error', (err) => this.logger.error(`Simulador MQTT: ${err.message}`));
  }

  private async emit(s: any) {
    const tickRes = await this.db.query(
      'UPDATE sim_sensors SET tick = tick + 1, updated_at = now() WHERE id = $1 RETURNING tick',
      [s.id],
    );
    const tick = Number(tickRes.rows[0]?.tick ?? 1);
    const idx = 0;

    // Escenario en espacio NEUTRONES (la app calcula θ con Geant4):
    // base con deriva senoidal + 1 excursión cada N (mojado=N bajo, seco=N alto).
    const every = Math.max(2, Number(s.anomaly_every) || 20);
    const baseN = Number(s.base_neutrons ?? 30);
    let nTarget = clamp(
      baseN + Math.sin(tick * 0.2 + idx) * 4 + (Math.random() * 3 - 1.5),
      N_NORMAL[0],
      N_NORMAL[1],
    );
    const isAnomalyTick = tick % every === 0;
    if (isAnomalyTick) {
      if (s.anomaly_mode === 'high') {
        // Humedad alta (aviso >= 85 %): el agua absorbe neutrones → N bajo.
        nTarget = N_WET[0] + Math.random() * (N_WET[1] - N_WET[0]);
      } else if (s.anomaly_mode === 'low') {
        // Humedad baja (alarma <= 15 %): suelo seco → N alto.
        nTarget = N_DRY[0] + Math.random() * (N_DRY[1] - N_DRY[0]);
      }
    }

    const baseP = Number(s.base_pressure);
    const pressure = clamp(baseP + Math.sin(tick * 0.15) * 6 + (Math.random() * 2 - 1), 700, 1200);
    const temperature = clamp(
      Number(s.base_temp) + Math.cos(tick * 0.2) * 4 + (Math.random() * 0.8 - 0.4),
      -50,
      90,
    );
    const battery = clamp(Number(s.base_battery) - tick * 0.0005, 0, 15);
    const rssi = Math.round(clamp(-95 - Math.random() * 15, -120, -30));
    const snr = +clamp(7.5 + (Math.random() * 3 - 1.5), -20, 20).toFixed(1);

    // Recuento medido: objetivo del escenario + ruido Poisson (~sqrt(N)).
    const neutrons = Math.max(5, Math.round(nTarget + gauss() * Math.sqrt(nTarget)));

    const eui = String(s.dev_eui).toLowerCase();
    const payload = {
      applicationId: '1',
      deviceInfo: {
        tenantId: '1',
        applicationId: '1',
        deviceProfileId: 'profile-soil-moisture',
        deviceName: s.name,
        devEui: eui,
      },
      time: new Date().toISOString(),
      fCnt: 100 + tick,
      fPort: 2,
      object: {
        // ÚNICA medida de humedad del sensor: recuento bruto de neutrones.
        neutron_counts: neutrons,
        temperature: +temperature.toFixed(2),
        battery: +battery.toFixed(2),
        pressure: +pressure.toFixed(1),
        ...(s.latitude !== null && s.latitude !== undefined ? { latitude: Number(s.latitude) } : {}),
        ...(s.longitude !== null && s.longitude !== undefined ? { longitude: Number(s.longitude) } : {}),
      },
      rxInfo: [{ gatewayId: 'AABBCCDDEEFF0011', rssi, snr }],
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.client) return reject(new Error('MQTT no conectado'));
      this.client.publish(`application/1/device/${eui}/event/up`, JSON.stringify(payload), { qos: 1 }, (err) =>
        err ? reject(err) : resolve(),
      );
    });
  }
}
