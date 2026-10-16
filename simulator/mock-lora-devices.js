/**
 * SIMULADOR DE SENSORES Y GATEWAYS LORAWAN (ChirpStack v4 + Mosquitto)
 * CORNEA by Neutron Insights
 *
 * Estructura:
 *   1. CONFIG (env/CLI) → 2. PERFILES SENSORES → 3. MOTOR ESCENARIOS (N)
 *   → 4. RUIDO POISSON → 5. BUILDER PAYLOAD → 6. SCHEDULER
 *
 * MODELO FÍSICO (como una sonda CRNS real): el simulador NO manda humedad.
 * Mide y transmite únicamente el recuento bruto de neutrones (N_raw); la
 * humedad volumétrica (θ) la calcula la app en el backend con el modelo
 * Geant4 calibrado: θ = a0·e^(-a1·N·fp/N0) + a2, con la corrección barométrica
 * fp = exp((P0-P)/L) usando la presión de ESE sensor.
 * Relación inversa (ver README): más N ⇔ MENOS humedad.
 *
 * Red fija: 3 sensores CORNEA (mismos DevEUI/nombre que el seed del backend).
 * Excursiones excepcionales: 1 mensaje anómalo cada 20 por sensor con
 * régimen (CORNEA 01 → mojado → aviso humidity >= 85 %, CORNEA 02 → seco →
 * alarma humidity <= 15 %, CORNEA 03 → siempre normal).
 *
 * Uso:
 *   node mock-lora-devices.js                 # Cada 30 minutos reales
 *   node mock-lora-devices.js --interval 5000 # Rápido para pruebas (5 seg)
 */

// ============================================================================
// 1. CONFIG (env/CLI — compatible con docker-compose.yml servicio `simulator`)
// ============================================================================
const mqtt = require('mqtt');

const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const MQTT_URL = process.env.MQTT_URL || getArg('--url', 'mqtt://localhost:1883');
const MQTT_USER = process.env.MQTT_USERNAME || getArg('--user', 'iot');
const MQTT_PASS = process.env.MQTT_PASSWORD || getArg('--pass', 'changeme');
const SENSOR_COUNT_REQ = parseInt(process.env.SENSOR_COUNT || getArg('--count', '3'), 10);
// 30 minutos reales por defecto (1800000 ms), como los sensores físicos.
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || getArg('--interval', '1800000'), 10);
const INJECT_ANOMALIES =
  process.env.INJECT_ANOMALIES === 'false' ? false : args.includes('--anomalies') || true;
// Backfill histórico: 10 muestras previas (cada INTERVAL_MS) para la gráfica.
const BACKFILL_RAW = parseInt(process.env.SIM_BACKFILL || getArg('--backfill', '10'), 10);
const BACKFILL = Number.isNaN(BACKFILL_RAW) ? 10 : Math.max(0, BACKFILL_RAW);

console.log('📡 =============================================================');
console.log('   CORNEA IoT - SIMULADOR DE RED LORAWAN (Neutron Insights)');
console.log('=============================================================');
console.log(`Broker MQTT: ${MQTT_URL}`);
if (SENSOR_COUNT_REQ !== 3) {
  console.log(`⚠️  Red CORNEA fija de 3 sensores: se ignora SENSOR_COUNT=${SENSOR_COUNT_REQ}.`);
}
console.log('Sensores CORNEA: 3 (01 Sionlla, 02 Castiñeiras, 03 Aloia)');
console.log(`Intervalo de transmisión: ${INTERVAL_MS / 1000} segundos (${INTERVAL_MS / 60000} minutos)`);
console.log(`Backfill histórico: ${BACKFILL} muestras previas cada ${INTERVAL_MS / 60000} min`);
console.log(`Excursiones anómalas: ${INJECT_ANOMALIES ? 'ACTIVADAS (1 cada 20)' : 'DESACTIVADAS'}`);
console.log('Medida transmitida: N_raw (cuantos) · la humedad la calcula la app (Geant4)');
console.log('-------------------------------------------------------------');

// ============================================================================
// 2. PERFILES SENSORES — red fija de 3 sensores CORNEA (mismos DevEUI y
//    nombre que el seed del backend para que seed y simulador coincidan).
//    `baseNeutrons` es el recuento base (NO humedad): ≈ θ 55/50/58 %.
//    Regímenes: CORNEA 01 → aviso, CORNEA 02 → alarma, CORNEA 03 → normal.
// ============================================================================
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const sensors = [
  {
    devEui: '0011223344556601',
    name: 'CORNEA 01 - Polígono da Sionlla (Santiago)',
    regime: 'warning-high',
    baseNeutrons: 34,
    baseTemp: 19,
    baseBattery: 3.9,
    basePressure: 1011.6,
    lat: 42.910917,
    lng: -8.49111,
    fcnt: 100,
  },
  {
    devEui: '0011223344556602',
    name: 'CORNEA 02 - Lago de Castiñeiras (Pontevedra)',
    regime: 'critical-low',
    baseNeutrons: 40,
    baseTemp: 18,
    baseBattery: 3.87,
    basePressure: 1012.8,
    lat: 42.3486,
    lng: -8.6747,
    fcnt: 100,
  },
  {
    devEui: '0011223344556603',
    name: 'CORNEA 03 - Monte Aloia, Tui (Pontevedra)',
    regime: 'normal',
    baseNeutrons: 32,
    baseTemp: 17,
    baseBattery: 3.84,
    basePressure: 1013.4,
    lat: 42.0682,
    lng: -8.675,
    fcnt: 100,
  },
];

// ============================================================================
// 3. MOTOR ESCENARIOS — recuento objetivo N por (sensor, tick)
//    El escenario vive en espacio NEUTRONES; la app traduce N → θ con Geant4.
//    Bandas calibradas con calibration_config.json (N0=143, P0=981.4, L=137):
//      · normal   N ≈ 15-60   → θ ≈ 30-72 %   (nunca dispara alerta)
//      · mojado   N ≈ 8-10    → θ ≈ 86-88 %   → aviso  humidity >= 85 %
//      · seco     N ≈ 102-110 → θ ≈ 12-14 %   → alarma humidity <= 15 %
//    Avisos/alertas EXCEPCIONALES: 1 de cada 20 por sensor, escalonados
//    (CORNEA 01 en tick%20==0, CORNEA 02 en tick%20==10: nunca el mismo ciclo).
//    Ojo: humedad alta ⇔ conteo BAJO (los neutrones se absorben en el agua).
//    NOTA: el backend suaviza θ con EMA (α=0.3 anti-Poisson), así que la
//    excursión aislada se ve en N (gráfica/raw) pero solo dispara evento si el
//    suavizado cruza el umbral (arranques en frío o rachas de ruido).
// ============================================================================
const CYCLE = 20;
const N_WET = [8, 10]; // θ 86-88 %   (aviso humidity >= 85)
const N_DRY = [102, 110]; // θ 12-14 %   (alarma humidity <= 15)
const N_NORMAL = [15, 60]; // θ 30-72 %   (sin alerta)

function scenarioNeutrons(sensor, tick, anomaliesOn) {
  // Base normal: deriva lenta senoidal + ruido leve en espacio N.
  const idx = sensors.indexOf(sensor);
  const normal = clamp(
    sensor.baseNeutrons + Math.sin(tick * 0.2 + idx) * 4 + (Math.random() * 3 - 1.5),
    N_NORMAL[0],
    N_NORMAL[1],
  );

  if (!anomaliesOn || sensor.regime === 'normal') return normal;

  if (sensor.regime === 'warning-high' && tick % CYCLE === 0) {
    return N_WET[0] + Math.random() * (N_WET[1] - N_WET[0]);
  }
  if (sensor.regime === 'critical-low' && tick % CYCLE === 10) {
    return N_DRY[0] + Math.random() * (N_DRY[1] - N_DRY[0]);
  }
  return normal;
}

function scenarioSecondary(sensor, tick) {
  // Rangos razonables del resto de métricas (la ingesta descarta imposibles).
  const idx = sensors.indexOf(sensor);
  const temperature = clamp(
    sensor.baseTemp + Math.cos(tick * 0.2 + idx) * 4 + (Math.random() * 0.8 - 0.4),
    8,
    28,
  );
  const battery = clamp(sensor.baseBattery - tick * 0.0005, 3.0, 4.1);
  const pressure = clamp(sensor.basePressure + Math.sin(tick * 0.15 + idx) * 6 + (Math.random() * 2 - 1), 980, 1020);
  const rssi = Math.round(clamp(-95 - Math.random() * 15, -115, -75));
  const snr = +clamp(7.5 + (Math.random() * 3 - 1.5), -2, 9).toFixed(1);
  return { temperature, battery, pressure, rssi, snr };
}

// ============================================================================
// 4. RUIDO POISSON del detector: la medida cruda es un recuento entero con
//    dispersión ~sqrt(N) (Box-Muller). Es el único "azar" de la sonda.
// ============================================================================
const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// ============================================================================
// 5. BUILDER PAYLOAD ChirpStack v4: SOLO medidas del sensor (N_raw + entorno).
//    Sin campo `humidity` ni binario: el backend deriva θ desde N_raw+presión.
// ============================================================================
function buildUplink(sensor, tick, timeISO, anomaliesOn) {
  const { temperature, battery, pressure, rssi, snr } = scenarioSecondary(sensor, tick);
  const nTarget = scenarioNeutrons(sensor, tick, anomaliesOn);

  // Recuento medido: objetivo del escenario + ruido Poisson (~sqrt(N)).
  const neutronCounts = Math.max(5, Math.round(nTarget + gauss() * Math.sqrt(nTarget)));

  sensor.fcnt += 1;
  const topic = `application/1/device/${sensor.devEui.toLowerCase()}/event/up`;
  const payload = {
    applicationId: '1',
    deviceInfo: {
      tenantId: '1',
      applicationId: '1',
      deviceProfileId: 'profile-soil-moisture',
      deviceName: sensor.name,
      devEui: sensor.devEui.toLowerCase(),
    },
    time: timeISO,
    fCnt: sensor.fcnt,
    fPort: 2,
    object: {
      // ÚNICA medida de humedad del sensor: el recuento bruto de neutrones.
      neutron_counts: neutronCounts,
      temperature: +temperature.toFixed(2),
      battery: +battery.toFixed(2),
      pressure: +pressure.toFixed(1),
      latitude: sensor.lat,
      longitude: sensor.lng,
    },
    rxInfo: [{ gatewayId: 'AABBCCDDEEFF0011', rssi, snr }],
  };
  return { topic, payload };
}

// ============================================================================
// 6. SCHEDULER — backfill 10 previas + actual + 1 mensaje/30min/sensor
//    Timestamps en rejilla de INTERVAL_MS (idempotente con ON CONFLICT en
//    ingesta, migración 003). OFFLINE_THRESHOLD_MINUTES=90 tolera 2 fallos.
// ============================================================================
const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `lora_sim_${Math.random().toString(16).substring(2, 8)}`,
});

const transmitUplinks = (tick, timeOverride, anomaliesOn = INJECT_ANOMALIES) => {
  const timeISO = timeOverride || new Date().toISOString();
  sensors.forEach((sensor) => {
    const { topic, payload } = buildUplink(sensor, tick, timeISO, anomaliesOn);
    client.publish(topic, JSON.stringify(payload), { qos: 1 });
  });
  console.log(
    `[${new Date().toLocaleTimeString()}] 📡 Uplinks enviados: ${sensors.length} sensores (ciclo #${tick}${timeOverride ? `, t=${timeOverride}` : ''}${anomaliesOn ? '' : ', sin anomalías'})`,
  );
};

client.on('connect', () => {
  console.log('✅ Conectado exitosamente al broker MQTT Mosquitto');
  console.log('🚀 Enviando histórico + primera ráfaga de telemetría...\n');

  // Backfill: 10 registros previos separados INTERVAL_MS (más antiguo primero),
  // con el ritmo 1/20 (el tick 1000 cae en la excursión de CORNEA 01: el
  // histórico ya muestra un pico de N y la gráfica evidencia N↔θ contrarios).
  // Timestamps en rejilla de intervalo (idempotente con ON CONFLICT).
  if (BACKFILL > 0) {
    const grid = Math.max(1000, INTERVAL_MS);
    const base = Math.floor(Date.now() / grid) * grid;
    // Ticks altos para no colisionar la fase con el ciclo vivo (tick 1…).
    const bfStart = 1000 - BACKFILL;
    for (let b = BACKFILL - 1; b >= 0; b--) {
      transmitUplinks(bfStart + (BACKFILL - b), new Date(base - b * INTERVAL_MS).toISOString(), INJECT_ANOMALIES);
    }
    console.log(`📦 Backfill: ${BACKFILL} muestras históricas por sensor enviadas (con episodios).`);
  }

  // Registro actual (ahora) + ciclo vivo cada 30 min.
  let tick = 1;
  transmitUplinks(tick);
  console.log(`⏳ Próximo envío programado en ${INTERVAL_MS / 60000} minutos...`);

  setInterval(() => {
    tick += 1;
    transmitUplinks(tick);
    console.log(`⏳ Próximo envío programado en ${INTERVAL_MS / 60000} minutos...`);
  }, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error('❌ Error de conexión MQTT:', err.message);
});