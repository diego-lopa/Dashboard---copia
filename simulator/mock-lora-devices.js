/**
 * SIMULADOR DE SENSORES Y GATEWAYS LORAWAN (ChirpStack v4 + Mosquitto)
 * CORNEA by Neutron Insights
 *
 * Estructura:
 *   1. CONFIG (env/CLI) → 2. PERFILES SENSORES → 3. MOTOR ESCENARIOS
 *   → 4. FISICA NEUTRONES → 5. BUILDER PAYLOAD → 6. SCHEDULER
 *
 * Uso:
 *   node mock-lora-devices.js                             # Cada 30 minutos reales
 *   node mock-lora-devices.js --interval 5000             # Rápido para pruebas (5 seg)
 *   node mock-lora-devices.js --interval 5000 --neutrons  # CRNS acelerado
 *   node mock-lora-devices.js --count 100 --interval 2000 # Prueba de carga
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
const SENSOR_COUNT = parseInt(process.env.SENSOR_COUNT || getArg('--count', '5'), 10);
// 30 minutos reales por defecto (1800000 ms), como las sondas físicas.
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || getArg('--interval', '1800000'), 10);
const INJECT_ANOMALIES =
  process.env.INJECT_ANOMALIES === 'false' ? false : args.includes('--anomalies') || true;
// Histórico inicial: 10 muestras previas (cada INTERVAL_MS) para la gráfica.
const BACKFILL_RAW = parseInt(process.env.SIM_BACKFILL || getArg('--backfill', '10'), 10);
const BACKFILL = Number.isNaN(BACKFILL_RAW) ? 10 : Math.max(0, BACKFILL_RAW);
// Modo neutrónico CRNS (activo por defecto): el backend calcula θ desde N_raw.
const NEUTRON_MODE = args.includes('--no-neutrons')
  ? false
  : args.includes('--neutrons') || process.env.NEUTRON_MODE !== 'false';

console.log('📡 =============================================================');
console.log('   CORNEA IoT - SIMULADOR DE RED LORAWAN (Neutron Insights)');
console.log('=============================================================');
console.log(`Broker MQTT: ${MQTT_URL}`);
console.log(`Dispositivos activos: ${SENSOR_COUNT}`);
console.log(`Intervalo de transmisión: ${INTERVAL_MS / 1000} segundos (${INTERVAL_MS / 60000} minutos)`);
console.log(`Backfill histórico: ${BACKFILL} muestras previas cada ${INTERVAL_MS / 60000} min`);
console.log(`Inyección de anomalías: ${INJECT_ANOMALIES ? 'ACTIVADA' : 'DESACTIVADA'}`);
console.log(`Modo neutrónico CRNS: ${NEUTRON_MODE ? 'ACTIVADO (θ calculada en backend)' : 'DESACTIVADO'}`);
console.log('-------------------------------------------------------------');

// ============================================================================
// 2. PERFILES SENSORES (DevEUI, nombre, ubicación, bases, régimen asignado)
//    Regímenes: sensor 0 → aviso (>85%), sensor 1 → alarma (<15%),
//    resto → siempre normal. Determinista para garantizar cobertura.
// ============================================================================
const galiciaLocations = [
  { name: 'Sensor Humedad - Lago de Castiñeiras (Pontevedra)', lat: 42.3486, lng: -8.6747 },
  { name: 'Estación Ambiental - Lago de Castiñeiras (Pontevedra)', lat: 42.3495, lng: -8.6738 },
  { name: 'Sensor Nivel Industrial - Polígono da Sionlla (Santiago)', lat: 42.9135, lng: -8.5132 },
  { name: 'Sensor Calidad Aire - Polígono da Sionlla (Santiago)', lat: 42.9142, lng: -8.5120 },
  { name: 'Sensor Agroclimático - Monte Aloia (Pontevedra)', lat: 42.0682, lng: -8.6750 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const sensors = [];
for (let i = 1; i <= SENSOR_COUNT; i++) {
  const hexSuffix = i.toString(16).padStart(2, '0');
  const locIndex = (i - 1) % galiciaLocations.length;
  const loc = galiciaLocations[locIndex];
  const regime = i === 1 ? 'warning-high' : i === 2 ? 'critical-low' : 'normal';
  sensors.push({
    devEui: `00112233445566${hexSuffix}`.toUpperCase(),
    name: SENSOR_COUNT <= 5 ? loc.name : `Sensor LoRaWAN #${i}`,
    regime,
    baseHumidity: 45 + ((i * 6) % 25), // 45-70% nominal
    baseTemp: 16 + ((i * 1.5) % 8), // 16-24°C nominal
    baseBattery: 3.95 - (i * 0.03), // 3.8-3.95V inicial
    basePressure: 1002 + (i % 5) * 2.5, // ~1002-1012 hPa
    lat: loc.lat + Math.floor(i / galiciaLocations.length) * 0.001,
    lng: loc.lng + Math.floor(i / galiciaLocations.length) * 0.001,
    fcnt: 100,
  });
}

// ============================================================================
// 3. MOTOR ESCENARIOS — humedad objetivo por (sensor, tick)
//    Reglas seed: warning humidity >= 85 (histeresis 3 → resuelve < 82),
//    critical humidity <= 15 (histeresis 3 → resuelve > 18).
//    Episodios sostenidos de 3 ticks para superar duration_seconds=300s
//    y permitir disparo + resolución visibles en gráfica/alertas.
//    Ciclo determinista de 10 ticks: 6 normal → 3 anomalía → 1 recuperación.
// ============================================================================
const CYCLE = 10;

function scenarioHumidity(sensor, tick, anomaliesOn) {
  // Base normal: deriva lenta senoidal + ruido leve (35-70%).
  const idx = sensors.indexOf(sensor);
  const normalBase =
    sensor.baseHumidity + Math.sin(tick * 0.2 + idx) * 5 + (Math.random() * 2 - 1);
  const normal = clamp(normalBase, 35, 70);

  if (!anomaliesOn || sensor.regime === 'normal') return normal;

  // Fase desplazada por sensor para no disparar aviso+alarma en el mismo tick.
  const phase = (((tick + idx * 4) % CYCLE) + CYCLE) % CYCLE;
  if (phase <= 5) return clamp(normal, 40, 70); // normalidad
  if (phase <= 8) {
    // episodio anomalía sostenido
    if (sensor.regime === 'warning-high') return 86 + Math.random() * 3; // 86-89%
    if (sensor.regime === 'critical-low') return 12 + Math.random() * 2; // 12-14%
  }
  // tick 9: recuperación (resuelve por histéresis)
  if (sensor.regime === 'warning-high') return 65.2;
  if (sensor.regime === 'critical-low') return 45 + Math.random() * 5;
  return normal;
}

function scenarioSecondary(sensor, tick) {
  // Rangos razonables resto de métricas (ingesta descarta humidity fuera 0-100).
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
// 4. FISICA NEUTRONES — inversa Geant4 θ → N_raw + ruido Poisson ~sqrt(N)
//    Bucle cerrado con presión del sensor: N_raw = ratio·N0 / fp,
//    fp = exp((P0-P)/L). El backend hace la directa N_corr = N_raw·fp,
//    así θ_final ≈ θ_objetivo (igual que seed.ts:218).
//    (cornea_pipeline/config/calibration_config.json)
// ============================================================================
const CAL = {
  N0: 143.0,
  a0: 107.38107297640175,
  a1: 3.0361746292354415,
  a2: -4.894223415942227,
  P0: 981.4,
  L: 137.0,
};

const gauss = () => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const humidityToNeutrons = (theta, pressureHpa = CAL.P0) => {
  const t = clamp(theta, 0.5, 99);
  const x = (t - CAL.a2) / CAL.a0;
  if (x <= 0) return Math.round(CAL.N0);
  const ratio = -Math.log(x) / CAL.a1;
  const fp = Math.exp((CAL.P0 - pressureHpa) / CAL.L);
  if (!(fp > 0)) return Math.round(CAL.N0);
  return Math.max(5, Math.round(((ratio * CAL.N0) / fp) * 10) / 10);
};

// ============================================================================
// 5. BUILDER PAYLOAD ChirpStack v4 (1 JSON/sensor con medidas)
// ============================================================================
function buildUplink(sensor, tick, timeISO, anomaliesOn) {
  // 1º presión del sensor (cada sonda tiene la suya), 2º humedad objetivo,
  // 3º N_raw con esa presión → el backend deriva θ ≈ objetivo.
  const { temperature, battery, pressure, rssi, snr } = scenarioSecondary(sensor, tick);
  const humidity = scenarioHumidity(sensor, tick, anomaliesOn);

  let neutronCounts;
  if (NEUTRON_MODE) {
    const nMean = humidityToNeutrons(humidity, pressure);
    neutronCounts = Math.max(5, Math.round(nMean + gauss() * Math.sqrt(nMean)));
  }

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
    data: Buffer.from([
      Math.floor(humidity * 10) >> 8,
      Math.floor(humidity * 10) & 0xff,
      Math.floor(temperature * 10) >> 8,
      Math.floor(temperature * 10) & 0xff,
      Math.floor(battery * 1000) >> 8,
      Math.floor(battery * 1000) & 0xff,
    ]).toString('base64'),
    object: {
      humidity: +humidity.toFixed(2),
      // En modo neutrónico el backend ignora `humidity` y calcula θ desde N_raw
      ...(NEUTRON_MODE ? { neutron_counts: neutronCounts } : {}),
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
  // CON episodios (anomalías activadas) para que el histórico ya muestre
  // normalidad + aviso + alarma y la gráfica evidencie N↔θ contrarios.
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
