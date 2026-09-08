import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://iot:changeme_db_password@localhost:5432/iot?schema=public';

async function seed() {
  console.log('🌱 Iniciando Seed de base de datos...');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();

    // 1. Crear o recuperar Tenant
    const tenantRes = await client.query(`
      INSERT INTO tenants (name)
      VALUES ('Neutron Insights - Agro & IoT Sector')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    let tenantId = tenantRes.rows[0]?.id;
    if (!tenantId) {
      const existing = await client.query(`SELECT id FROM tenants LIMIT 1;`);
      tenantId = existing.rows[0].id;
    }
    console.log(`✅ Tenant listo: ${tenantId}`);

    // 2. Crear Usuarios
    const adminPass = await bcrypt.hash('admin123456', 10);
    const opPass = await bcrypt.hash('operator123', 10);
    const viewerPass = await bcrypt.hash('viewer123', 10);

    await client.query(`
      INSERT INTO users (tenant_id, email, password_hash, role, enabled)
      VALUES 
        ('${tenantId}', 'admin@example.com', '${adminPass}', 'admin', true),
        ('${tenantId}', 'operator@example.com', '${opPass}', 'operator', true),
        ('${tenantId}', 'viewer@example.com', '${viewerPass}', 'viewer', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `);
    console.log('✅ Usuarios seed creados (admin@example.com / admin123456)');

    // 3. Crear Dispositivos LoRaWAN de Demostración (Galicia: Pontevedra y Santiago de Compostela)
    const sampleDevices = [
      {
        dev_eui: '0011223344556601',
        name: 'Sensor Humedad Suelo - Lago de Castiñeiras (Pontevedra)',
        description: 'Sonda capacitiva de humedad y temperatura en parque natural Lago de Castiñeiras',
        group_name: 'Pontevedra - Lago de Castiñeiras',
        latitude: 42.348600,
        longitude: -8.674700,
        humidity_min: 35.0,
        humidity_max: 82.0,
      },
      {
        dev_eui: '0011223344556602',
        name: 'Estación Agroclimática - Lago de Castiñeiras (Pontevedra)',
        description: 'Monitoreo ambiental: humedad, temperatura y pluviometría',
        group_name: 'Pontevedra - Lago de Castiñeiras',
        latitude: 42.349500,
        longitude: -8.673800,
        humidity_min: 28.0,
        humidity_max: 75.0,
      },
      {
        dev_eui: '0011223344556603',
        name: 'Sensor Nivel Industrial - Polígono Industrial da Sionlla',
        description: 'Monitoreo ambiental e industrial en Polígono da Sionlla (Santiago de Compostela)',
        group_name: 'Santiago - Polígono da Sionlla',
        latitude: 42.913500,
        longitude: -8.513200,
        humidity_min: 40.0,
        humidity_max: 85.0,
      },
      {
        dev_eui: '0011223344556604',
        name: 'Sensor Calidad Aire - Polígono Industrial da Sionlla',
        description: 'Sensor LoRaWAN de calidad ambiental y partículas',
        group_name: 'Santiago - Polígono da Sionlla',
        latitude: 42.914200,
        longitude: -8.512000,
        humidity_min: 30.0,
        humidity_max: 78.0,
      },
      {
        dev_eui: '0011223344556605',
        name: 'Sensor Agroclimático - Monte Aloia (Pontevedra)',
        description: 'Sonda forestal en Parque Natural Monte Aloia (Tui - Provincia de Pontevedra)',
        group_name: 'Pontevedra - Monte Aloia (Tui)',
        latitude: 42.068200,
        longitude: -8.675000,
        humidity_min: 45.0,
        humidity_max: 90.0,
      },
    ];

    const deviceIds: string[] = [];

    for (const dev of sampleDevices) {
      const devRes = await client.query(`
        INSERT INTO devices (tenant_id, dev_eui, name, description, group_name, latitude, longitude, humidity_min_threshold, humidity_max_threshold, last_seen_at)
        VALUES (
          '${tenantId}', 
          '${dev.dev_eui}', 
          '${dev.name}', 
          '${dev.description}', 
          '${dev.group_name}', 
          ${dev.latitude}, 
          ${dev.longitude}, 
          ${dev.humidity_min}, 
          ${dev.humidity_max},
          now()
        )
        ON CONFLICT (dev_eui) DO UPDATE SET 
          name = EXCLUDED.name,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          last_seen_at = now()
        RETURNING id;
      `);
      deviceIds.push(devRes.rows[0].id);
    }
    console.log(`✅ ${deviceIds.length} dispositivos LoRaWAN registrados`);

    // 4. Crear Reglas de Alerta Predeterminadas
    await client.query(`
      INSERT INTO alert_rules (tenant_id, name, metric, condition, threshold, duration_seconds, hysteresis, severity, enabled, channels)
      VALUES 
        ('${tenantId}', 'Alerta Global: Humedad Excesiva (>80%)', 'humidity', '>=', 80.0, 300, 3.0, 'warning', true, '["webhook", "email"]'::jsonb),
        ('${tenantId}', 'Alerta Global: Estrés Hídrico Crítico (<30%)', 'humidity', '<=', 30.0, 300, 3.0, 'critical', true, '["webhook", "email"]'::jsonb),
        ('${tenantId}', 'Alerta Global: Batería Sensor Baja (<20%)', 'battery', '<=', 20.0, 0, 1.0, 'warning', true, '["webhook"]'::jsonb),
        ('${tenantId}', 'Alerta Global: Calidad de Señal Débil (RSSI < -115 dBm)', 'rssi', '<=', -115.0, 600, 2.0, 'low', true, '["webhook"]'::jsonb)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Reglas de alerta configuradas');

    // 5. Generar Histórico de Mediciones de Ejemplo (Últimas 48 horas)
    console.log('⏳ Generando histórico de 48 horas de telemetría para demostración...');
    const now = Date.now();
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
    const intervalMinutes = 15;
    const totalSteps = (48 * 60) / intervalMinutes;

    for (let i = 0; i < deviceIds.length; i++) {
      const devId = deviceIds[i];
      const baseHum = 45 + i * 7;
      const baseTemp = 21 + i * 1.5;
      const baseBatt = 3.9 - i * 0.1;

      for (let step = 0; step < totalSteps; step++) {
        const timePoint = new Date(fortyEightHoursAgo + step * intervalMinutes * 60 * 1000);
        // Ciclo diario de temperatura y humedad
        const hourOfDay = timePoint.getUTCHours();
        const tempVariation = Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 6;
        const humVariation = -Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 12;

        const humidity = Math.min(98, Math.max(15, baseHum + humVariation + (Math.random() * 4 - 2)));
        const temperature = baseTemp + tempVariation + (Math.random() * 1.5 - 0.75);
        const pressure = 1013.2 + (Math.random() * 4 - 2);
        const battery = Math.max(2.8, baseBatt - (step / totalSteps) * 0.05 + (Math.random() * 0.02 - 0.01));
        const rssi = -95 - Math.floor(Math.random() * 18);
        const snr = +(7.5 + (Math.random() * 4 - 2)).toFixed(1);

        await client.query(`
          INSERT INTO measurements (
            time, device_id, humidity, temperature, pressure, battery, rssi, snr, gateway_id, fcnt_up, valid
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, 'GATEWAY_GW01_MADRID', $9, true
          ) ON CONFLICT DO NOTHING;
        `, [
          timePoint.toISOString(),
          devId,
          +humidity.toFixed(2),
          +temperature.toFixed(2),
          +pressure.toFixed(2),
          +battery.toFixed(2),
          rssi,
          snr,
          step + 1,
        ]);
      }
    }
    console.log('✅ Histórico time-series de 48h generado con éxito.');

    client.release();
    await pool.end();
    console.log('🎉 Seed completado satisfactoriamente.');
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  }
}

seed();
