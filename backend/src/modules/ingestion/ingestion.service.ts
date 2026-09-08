import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayloadCodecService } from './codecs/payload-codec.service';
import { AlertsEngineService } from '../alerts/alerts-engine.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NormalizedUplink } from '../../shared/types';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly codec: PayloadCodecService,
    private readonly alertsEngine: AlertsEngineService,
    private readonly realtime: RealtimeService,
  ) {}

  async processRawMessage(rawPayload: any): Promise<boolean> {
    const normalized = this.codec.decode(rawPayload);
    if (!normalized) {
      this.logger.warn('Descartando mensaje que no pudo ser decodificado');
      return false;
    }
    return this.ingestNormalizedUplink(normalized);
  }

  async ingestNormalizedUplink(uplink: NormalizedUplink): Promise<boolean> {
    try {
      const devEui = uplink.devEui.toUpperCase();

      // 1. Validar rangos físicos
      const isValid = this.validatePhysicalRanges(uplink);
      if (!isValid) {
        this.logger.warn(`Telemetría fuera de rangos físicos para ${devEui}: ${JSON.stringify(uplink)}`);
      }

      // 2. Buscar o auto-provisionar dispositivo
      let device = await this.findDeviceByDevEui(devEui);
      if (!device) {
        device = await this.autoProvisionDevice(devEui);
      }

      if (!device.enabled) {
        this.logger.debug(`Dispositivo ${devEui} deshabilitado, ignorando telemetría`);
        return false;
      }

      const timestamp = uplink.timestamp ? new Date(uplink.timestamp).toISOString() : new Date().toISOString();

      // 3. Persistir en TimescaleDB Hypertable
      const insertSql = `
        INSERT INTO measurements (
          time, device_id, humidity, temperature, pressure, battery,
          latitude, longitude, rssi, snr, gateway_id, fcnt_up, raw_payload, valid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
      `;

      await this.db.query(insertSql, [
        timestamp,
        device.id,
        uplink.humidity !== undefined ? +uplink.humidity.toFixed(2) : null,
        uplink.temperature !== undefined ? +uplink.temperature.toFixed(2) : null,
        uplink.pressure !== undefined ? +uplink.pressure.toFixed(2) : null,
        uplink.battery !== undefined ? +uplink.battery.toFixed(2) : null,
        uplink.latitude ?? device.latitude,
        uplink.longitude ?? device.longitude,
        uplink.rssi ?? null,
        uplink.snr ?? null,
        uplink.gatewayId ?? null,
        uplink.fCntUp ?? null,
        uplink.rawPayload ?? null,
        isValid,
      ]);

      // 4. Actualizar last_seen_at y coordenadas en tabla devices
      await this.db.query(
        `UPDATE devices 
         SET last_seen_at = $1, 
             latitude = COALESCE($2, latitude), 
             longitude = COALESCE($3, longitude), 
             updated_at = now() 
         WHERE id = $4`,
        [timestamp, uplink.latitude || null, uplink.longitude || null, device.id],
      );

      // 5. Evaluar Reglas de Alertas en Tiempo Real
      await this.alertsEngine.evaluateUplink(device, uplink);

      // 6. Transmitir en Tiempo Real por SSE/WebSockets
      this.realtime.broadcastMeasurement(device.id, device.dev_eui, {
        humidity: uplink.humidity,
        temperature: uplink.temperature,
        pressure: uplink.pressure,
        battery: uplink.battery,
        rssi: uplink.rssi,
        snr: uplink.snr,
        timestamp,
        status: 'online',
      });

      return true;
    } catch (error) {
      this.logger.error(`Error procesando uplink para ${uplink.devEui}: ${error.message}`);
      return false;
    }
  }

  private validatePhysicalRanges(u: NormalizedUplink): boolean {
    if (u.humidity !== undefined && (u.humidity < 0 || u.humidity > 100)) return false;
    if (u.temperature !== undefined && (u.temperature < -50 || u.temperature > 90)) return false;
    if (u.pressure !== undefined && (u.pressure < 700 || u.pressure > 1200)) return false;
    if (u.battery !== undefined && (u.battery < 0 || u.battery > 15)) return false;
    return true;
  }

  private async findDeviceByDevEui(devEui: string) {
    const res = await this.db.query('SELECT * FROM devices WHERE dev_eui = $1', [devEui]);
    return res.rows[0] || null;
  }

  private async autoProvisionDevice(devEui: string) {
    this.logger.log(`Auto-aprovisionando nuevo sensor LoRaWAN detectado: ${devEui}`);
    const tenantRes = await this.db.query('SELECT id FROM tenants LIMIT 1');
    const tenantId = tenantRes.rows[0]?.id;

    if (!tenantId) {
      throw new Error('No existe ningún tenant para asociar el dispositivo auto-descubierto');
    }

    const insertRes = await this.db.query(
      `INSERT INTO devices (tenant_id, dev_eui, name, description, group_name, enabled, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, true, now())
       RETURNING *`,
      [
        tenantId,
        devEui,
        `Sensor LoRaWAN (${devEui.slice(-4)})`,
        'Sensor auto-aprovisionado automáticamente tras recibir primer uplink',
        'Auto-Descubiertos',
      ],
    );

    return insertRes.rows[0];
  }
}
