import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/create-device.dto';
import { DeviceEntity } from '../../shared/types';

@Injectable()
export class DevicesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(tenantId: string): Promise<DeviceEntity[]> {
    // Consulta optimizada extrayendo la última medición de cada sensor y estado de alertas activas
    const query = `
      WITH latest_measurements AS (
        SELECT DISTINCT ON (device_id)
          device_id,
          time as last_measurement_time,
          humidity as latest_humidity,
          temperature as latest_temperature,
          battery as latest_battery,
          rssi as latest_rssi,
          snr as latest_snr
        FROM measurements
        ORDER BY device_id, time DESC
      ),
      active_alerts_count AS (
        SELECT device_id, COUNT(*) as alert_count
        FROM alert_events
        WHERE state = 'triggered'
        GROUP BY device_id
      )
      SELECT 
        d.*,
        lm.latest_humidity,
        lm.latest_temperature,
        lm.latest_battery,
        lm.latest_rssi,
        lm.latest_snr,
        COALESCE(ac.alert_count, 0)::int as active_alerts,
        CASE
          WHEN NOT d.enabled THEN 'offline'
          WHEN d.last_seen_at IS NULL OR d.last_seen_at < (now() - interval '15 minutes') THEN 'offline'
          WHEN COALESCE(ac.alert_count, 0) > 0 THEN 'warning'
          WHEN lm.latest_battery IS NOT NULL AND lm.latest_battery <= d.battery_threshold THEN 'warning'
          ELSE 'online'
        END as status
      FROM devices d
      LEFT JOIN latest_measurements lm ON lm.device_id = d.id
      LEFT JOIN active_alerts_count ac ON ac.device_id = d.id
      WHERE d.tenant_id = $1
      ORDER BY d.name ASC;
    `;
    const res = await this.db.query(query, [tenantId]);
    return res.rows;
  }

  async findOne(id: string, tenantId: string): Promise<DeviceEntity> {
    const query = `
      WITH latest_measurements AS (
        SELECT DISTINCT ON (device_id)
          device_id,
          time as last_measurement_time,
          humidity as latest_humidity,
          temperature as latest_temperature,
          pressure as latest_pressure,
          battery as latest_battery,
          rssi as latest_rssi,
          snr as latest_snr,
          gateway_id as latest_gateway
        FROM measurements
        WHERE device_id = $1
        ORDER BY device_id, time DESC
      ),
      active_alerts_count AS (
        SELECT device_id, COUNT(*) as alert_count
        FROM alert_events
        WHERE device_id = $1 AND state = 'triggered'
        GROUP BY device_id
      )
      SELECT 
        d.*,
        lm.latest_humidity,
        lm.latest_temperature,
        lm.latest_pressure,
        lm.latest_battery,
        lm.latest_rssi,
        lm.latest_snr,
        lm.latest_gateway,
        COALESCE(ac.alert_count, 0)::int as active_alerts,
        CASE
          WHEN NOT d.enabled THEN 'offline'
          WHEN d.last_seen_at IS NULL OR d.last_seen_at < (now() - interval '15 minutes') THEN 'offline'
          WHEN COALESCE(ac.alert_count, 0) > 0 THEN 'warning'
          WHEN lm.latest_battery IS NOT NULL AND lm.latest_battery <= d.battery_threshold THEN 'warning'
          ELSE 'online'
        END as status
      FROM devices d
      LEFT JOIN latest_measurements lm ON lm.device_id = d.id
      LEFT JOIN active_alerts_count ac ON ac.device_id = d.id
      WHERE d.id = $1 AND d.tenant_id = $2;
    `;
    const res = await this.db.query(query, [id, tenantId]);
    if (res.rows.length === 0) {
      throw new NotFoundException('Dispositivo no encontrado');
    }
    return res.rows[0];
  }

  async getLatestMetrics(tenantId: string) {
    const devices = await this.findAll(tenantId);
    return devices.map((d) => ({
      id: d.id,
      devEui: d.dev_eui,
      name: d.name,
      groupName: d.group_name,
      status: d.status,
      lastSeenAt: d.last_seen_at,
      humidity: d.latest_humidity,
      temperature: d.latest_temperature,
      battery: d.latest_battery,
      rssi: d.latest_rssi,
      snr: d.latest_snr,
    }));
  }

  async create(tenantId: string, dto: CreateDeviceDto) {
    const devEui = dto.devEui.toUpperCase().trim();
    const existing = await this.db.query('SELECT id FROM devices WHERE dev_eui = $1', [devEui]);
    if (existing.rows.length > 0) {
      throw new ConflictException(`El DevEUI ${devEui} ya se encuentra registrado`);
    }

    const query = `
      INSERT INTO devices (
        tenant_id, dev_eui, name, description, group_name, latitude, longitude,
        enabled, battery_threshold, humidity_min_threshold, humidity_max_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const res = await this.db.query(query, [
      tenantId,
      devEui,
      dto.name.trim(),
      dto.description || null,
      dto.groupName || 'General',
      dto.latitude || null,
      dto.longitude || null,
      dto.enabled !== undefined ? dto.enabled : true,
      dto.batteryThreshold || 20.0,
      dto.humidityMinThreshold || 30.0,
      dto.humidityMaxThreshold || 80.0,
    ]);

    return res.rows[0];
  }

  async update(id: string, tenantId: string, dto: UpdateDeviceDto) {
    await this.findOne(id, tenantId);

    const fields: string[] = ['updated_at = now()'];
    const values: any[] = [id, tenantId];
    let idx = 3;

    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.groupName !== undefined) {
      fields.push(`group_name = $${idx++}`);
      values.push(dto.groupName);
    }
    if (dto.latitude !== undefined) {
      fields.push(`latitude = $${idx++}`);
      values.push(dto.latitude);
    }
    if (dto.longitude !== undefined) {
      fields.push(`longitude = $${idx++}`);
      values.push(dto.longitude);
    }
    if (dto.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(dto.enabled);
    }
    if (dto.batteryThreshold !== undefined) {
      fields.push(`battery_threshold = $${idx++}`);
      values.push(dto.batteryThreshold);
    }
    if (dto.humidityMinThreshold !== undefined) {
      fields.push(`humidity_min_threshold = $${idx++}`);
      values.push(dto.humidityMinThreshold);
    }
    if (dto.humidityMaxThreshold !== undefined) {
      fields.push(`humidity_max_threshold = $${idx++}`);
      values.push(dto.humidityMaxThreshold);
    }

    const query = `
      UPDATE devices
      SET ${fields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *;
    `;
    const res = await this.db.query(query, values);
    return res.rows[0];
  }

  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.db.query('DELETE FROM devices WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return { success: true, message: 'Dispositivo y su telemetría eliminados' };
  }
}
