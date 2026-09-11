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

    // 1. Recuperar o crear Tenant (determinista: nunca duplica).
    // Prioridad: tenant con dispositivos > tenant más antiguo > crear uno.
    const existingTenant = await client.query(`
      (SELECT tenant_id AS id FROM devices LIMIT 1)
      UNION ALL
      (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1)
      LIMIT 1;
    `);

    let tenantId = existingTenant.rows[0]?.id;
    if (!tenantId) {
      const created = await client.query(`
        INSERT INTO tenants (name)
        VALUES ('Neutron Insights - Agro & IoT Sector')
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
      `);
      tenantId = created.rows[0]?.id;
      if (!tenantId) {
        const fallback = await client.query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1;`);
        tenantId = fallback.rows[0]?.id;
      }
    }
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant');
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
    // Nomenclatura: código numérico (sufijo DevEUI) + identificativo reconocible.
    // Umbrales agronómicos Galicia: 20 % estrés hídrico / 65 % encharcamiento.
    const sampleDevices = [
      {
        dev_eui: '0011223344556601',
        name: 'Sonda 01 · Lago de Castiñeiras (Pontevedra)',
        description: 'Sonda CRNS de humedad y temperatura en parque natural Lago de Castiñeiras',
        group_name: 'Pontevedra - Lago de Castiñeiras',
        latitude: 42.348600,
        longitude: -8.674700,
        humidity_min: 15.0,
        humidity_max: 85.0,
      },
      {
        dev_eui: '0011223344556602',
        name: 'Sonda 02 · Lago de Castiñeiras – Estación (Pontevedra)',
        description: 'Estación agroclimática CRNS: humedad, temperatura y pluviometría',
        group_name: 'Pontevedra - Lago de Castiñeiras',
        latitude: 42.349500,
        longitude: -8.673800,
        humidity_min: 15.0,
        humidity_max: 85.0,
      },
      {
        dev_eui: '0011223344556603',
        name: 'Sonda 03 · Polígono da Sionlla (Santiago)',
        description: 'Sonda CRNS ambiental e industrial en Polígono da Sionlla (Santiago de Compostela)',
        group_name: 'Santiago - Polígono da Sionlla',
        latitude: 42.913500,
        longitude: -8.513200,
        humidity_min: 15.0,
        humidity_max: 85.0,
      },
      {
        dev_eui: '0011223344556604',
        name: 'Sonda 04 · Polígono da Sionlla – Aire (Santiago)',
        description: 'Sonda CRNS de calidad ambiental y partículas',
        group_name: 'Santiago - Polígono da Sionlla',
        latitude: 42.914200,
        longitude: -8.512000,
        humidity_min: 15.0,
        humidity_max: 85.0,
      },
      {
        dev_eui: '0011223344556605',
        name: 'Sonda 05 · Monte Aloia, Tui (Pontevedra)',
        description: 'Sonda CRNS forestal en Parque Natural Monte Aloia (Tui - Provincia de Pontevedra)',
        group_name: 'Pontevedra - Monte Aloia (Tui)',
        latitude: 42.068200,
        longitude: -8.675000,
        humidity_min: 15.0,
        humidity_max: 85.0,
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
          humidity_min_threshold = EXCLUDED.humidity_min_threshold,
          humidity_max_threshold = EXCLUDED.humidity_max_threshold,
          last_seen_at = now()
        RETURNING id;
      `);
      deviceIds.push(devRes.rows[0].id);
    }
    console.log(`✅ ${deviceIds.length} dispositivos LoRaWAN registrados`);

    // 4. Reglas de Alerta Predeterminadas (rango humedad 15–85 %: fuera de rango dispara).
    // 4a. Normalizar reglas globales de humedad existentes (idempotente, no duplica)
    await client.query(`
      UPDATE alert_rules
      SET name = 'Alerta Global: Humedad Excesiva (>85%)', threshold = 85.0,
          severity = 'warning', hysteresis = 3.0, duration_seconds = 300,
          enabled = true, updated_at = now()
      WHERE metric = 'humidity' AND condition = '>=' AND device_id IS NULL;
    `);
    await client.query(`
      UPDATE alert_rules
      SET name = 'Alerta Global: Estrés Hídrico Crítico (<15%)', threshold = 15.0,
          severity = 'critical', hysteresis = 3.0, duration_seconds = 300,
          enabled = true, updated_at = now()
      WHERE metric = 'humidity' AND condition = '<=' AND device_id IS NULL;
    `);
    // 4b. Eliminar reglas duplicadas sin eventos (el seed antiguo las duplicaba al reejecutarse)
    await client.query(`
      DELETE FROM alert_rules
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY tenant_id, metric, condition, COALESCE(device_id::text, '')
            ORDER BY created_at, id
          ) AS rn
          FROM alert_rules
        ) t WHERE rn > 1
      )
      AND NOT EXISTS (SELECT 1 FROM alert_events e WHERE e.rule_id = alert_rules.id);
    `);
    // 4c. Crear las que falten (solo instalaciones frescas, sin duplicar)
    const defaultRules = [
      { name: 'Alerta Global: Humedad Excesiva (>85%)', metric: 'humidity', condition: '>=', threshold: 85.0, duration: 300, hyst: 3.0, severity: 'warning', channels: '["webhook", "email"]' },
      { name: 'Alerta Global: Estrés Hídrico Crítico (<15%)', metric: 'humidity', condition: '<=', threshold: 15.0, duration: 300, hyst: 3.0, severity: 'critical', channels: '["webhook"]' },
      { name: 'Alerta Global: Batería Sensor Baja (<20%)', metric: 'battery', condition: '<=', threshold: 20.0, duration: 0, hyst: 1.0, severity: 'warning', channels: '["webhook"]' },
      { name: 'Alerta Global: Calidad de Señal Débil (RSSI < -115 dBm)', metric: 'rssi', condition: '<=', threshold: -115.0, duration: 600, hyst: 2.0, severity: 'low', channels: '["webhook"]' },
    ];
    for (const r of defaultRules) {
      await client.query(
        `INSERT INTO alert_rules (tenant_id, name, metric, condition, threshold, duration_seconds, hysteresis, severity, enabled, channels)
         SELECT $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::float8, $6::int, $7::float8, $8::varchar, true, $9::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM alert_rules
           WHERE tenant_id = $1::uuid AND metric = $3::varchar AND condition = $4::varchar AND device_id IS NULL
         );`,
        [tenantId, r.name, r.metric, r.condition, r.threshold, r.duration, r.hyst, r.severity, r.channels],
      );
    }
    console.log('✅ Reglas de alerta configuradas (rango 15–85 %)');

    // 5. Generar Histórico de Mediciones de Ejemplo (Últimas 48 horas).
    // Incluye N_raw estimado desde la humedad (inversa Geant4) para que todos
    // los registros históricos tengan todos los tipos de datos.
    console.log('⏳ Generando histórico de 48 horas de telemetría para demostración...');
    const CAL = { N0: 143.0, a0: 107.38107297640175, a1: 3.0361746292354415, a2: -4.894223415942227, P0: 981.4, L: 137.0 };
    const estimateN = (h: number, p: number) => {
      const t = Math.min(99, Math.max(0.5, h));
      const x = (t - CAL.a2) / CAL.a0;
      if (x <= 0) return Math.round(CAL.N0);
      const fp = Math.exp((CAL.P0 - p) / CAL.L);
      if (!(fp > 0)) return Math.round(CAL.N0);
      return Math.max(1, Math.round(((-Math.log(x) / CAL.a1) * CAL.N0) / fp * 10) / 10);
    };
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
            time, device_id, humidity, temperature, pressure, battery, rssi, snr, gateway_id, fcnt_up, valid, neutron_counts
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, 'GATEWAY_GW01_MADRID', $9, true, $10
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
          estimateN(humidity, pressure),
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
