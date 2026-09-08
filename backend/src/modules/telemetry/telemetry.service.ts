import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';

@Injectable()
export class TelemetryService {
  constructor(private readonly db: DatabaseService) {}

  async getDeviceMeasurements(deviceId: string, tenantId: string, query: TelemetryQueryDto) {
    // 1. Validar que el dispositivo pertenezca al tenant
    const devCheck = await this.db.query(
      'SELECT id, name, dev_eui FROM devices WHERE id = $1 AND tenant_id = $2',
      [deviceId, tenantId],
    );
    if (devCheck.rows.length === 0) {
      throw new NotFoundException('Dispositivo no encontrado');
    }

    const fromDate = query.from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toDate = query.to || new Date().toISOString();
    const interval = query.interval || 'raw';

    // 2. Si se solicita datos raw (sin agregación)
    if (interval === 'raw') {
      const sql = `
        SELECT 
          time,
          humidity,
          temperature,
          pressure,
          battery,
          latitude,
          longitude,
          rssi,
          snr,
          gateway_id,
          fcnt_up
        FROM measurements
        WHERE device_id = $1 AND time >= $2 AND time <= $3 AND valid = true
        ORDER BY time ASC
        LIMIT 5000;
      `;
      const res = await this.db.query(sql, [deviceId, fromDate, toDate]);
      return {
        deviceId,
        device: devCheck.rows[0],
        interval: 'raw',
        count: res.rows.length,
        data: res.rows,
      };
    }

    // 3. Normalizar intervalo TimescaleDB (1m -> '1 minute', 5m -> '5 minutes', 15m -> '15 minutes', 1h -> '1 hour', 1d -> '1 day')
    let pgInterval = '15 minutes';
    if (interval === '1m') pgInterval = '1 minute';
    else if (interval === '5m') pgInterval = '5 minutes';
    else if (interval === '15m') pgInterval = '15 minutes';
    else if (interval === '1h') pgInterval = '1 hour';
    else if (interval === '1d') pgInterval = '1 day';

    // 4. Consulta con time_bucket de TimescaleDB
    const sql = `
      SELECT 
        time_bucket($1::interval, time) AS bucket,
        ROUND(AVG(humidity)::numeric, 2) AS avg_humidity,
        ROUND(MIN(humidity)::numeric, 2) AS min_humidity,
        ROUND(MAX(humidity)::numeric, 2) AS max_humidity,
        ROUND(AVG(temperature)::numeric, 2) AS avg_temperature,
        ROUND(MIN(temperature)::numeric, 2) AS min_temperature,
        ROUND(MAX(temperature)::numeric, 2) AS max_temperature,
        ROUND(AVG(pressure)::numeric, 2) AS avg_pressure,
        ROUND(AVG(battery)::numeric, 2) AS avg_battery,
        ROUND(AVG(rssi)::numeric, 0) AS avg_rssi,
        ROUND(AVG(snr)::numeric, 1) AS avg_snr,
        COUNT(*) AS samples
      FROM measurements
      WHERE device_id = $2 AND time >= $3 AND time <= $4 AND valid = true
      GROUP BY bucket
      ORDER BY bucket ASC;
    `;

    const res = await this.db.query(sql, [pgInterval, deviceId, fromDate, toDate]);

    return {
      deviceId,
      device: devCheck.rows[0],
      interval,
      count: res.rows.length,
      data: res.rows,
    };
  }

  async exportCsv(deviceId: string, tenantId: string, query: TelemetryQueryDto): Promise<string> {
    const result = await this.getDeviceMeasurements(deviceId, tenantId, query);
    const rows = result.data;

    if (result.interval === 'raw') {
      const headers = [
        'Timestamp (UTC)',
        'Device Name',
        'DevEUI',
        'Humidity (%)',
        'Temperature (°C)',
        'Pressure (hPa)',
        'Battery (V)',
        'Latitude',
        'Longitude',
        'RSSI (dBm)',
        'SNR (dB)',
        'FCntUp',
      ];

      const csvLines = [headers.join(',')];
      for (const r of rows) {
        csvLines.push(
          [
            new Date(r.time).toISOString(),
            `"${result.device.name}"`,
            result.device.dev_eui,
            r.humidity ?? '',
            r.temperature ?? '',
            r.pressure ?? '',
            r.battery ?? '',
            r.latitude ?? '',
            r.longitude ?? '',
            r.rssi ?? '',
            r.snr ?? '',
            r.fcnt_up ?? '',
          ].join(','),
        );
      }
      return csvLines.join('\n');
    } else {
      const headers = [
        'Time Bucket (UTC)',
        'Device Name',
        'DevEUI',
        'Avg Humidity (%)',
        'Min Humidity (%)',
        'Max Humidity (%)',
        'Avg Temp (°C)',
        'Min Temp (°C)',
        'Max Temp (°C)',
        'Avg Pressure (hPa)',
        'Avg Battery (V)',
        'Avg RSSI (dBm)',
        'Samples',
      ];

      const csvLines = [headers.join(',')];
      for (const r of rows) {
        csvLines.push(
          [
            new Date(r.bucket).toISOString(),
            `"${result.device.name}"`,
            result.device.dev_eui,
            r.avg_humidity ?? '',
            r.min_humidity ?? '',
            r.max_humidity ?? '',
            r.avg_temperature ?? '',
            r.min_temperature ?? '',
            r.max_temperature ?? '',
            r.avg_pressure ?? '',
            r.avg_battery ?? '',
            r.avg_rssi ?? '',
            r.samples,
          ].join(','),
        );
      }
      return csvLines.join('\n');
    }
  }
}
