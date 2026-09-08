/**
 * SIMULADOR DE SENSORES Y GATEWAYS LORAWAN (ChirpStack v4 + Mosquitto)
 * Desarrollado para CORNEA by Neutron Insights
 * 
 * Intervalo por defecto: 5 minutos reales (300.000 ms)
 * 
 * Uso:
 *   node mock-lora-devices.js                             # Transmisión cada 5 minutos reales
 *   node mock-lora-devices.js --interval 5000             # Modo rápido para pruebas (5 seg)
 *   node mock-lora-devices.js --count 100 --interval 2000 # Prueba de carga
 */

const mqtt = require('mqtt');

// Parámetros CLI
const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const MQTT_URL = process.env.MQTT_URL || getArg('--url', 'mqtt://localhost:1883');
const MQTT_USER = process.env.MQTT_USERNAME || getArg('--user', 'iot');
const MQTT_PASS = process.env.MQTT_PASSWORD || getArg('--pass', 'changeme');
const SENSOR_COUNT = parseInt(getArg('--count', '5'), 10);
// Por defecto: 5 minutos reales (300.000 ms)
const INTERVAL_MS = parseInt(getArg('--interval', '300000'), 10);
const INJECT_ANOMALIES = args.includes('--anomalies') || true;

console.log('📡 =============================================================');
console.log('   CORNEA IoT - SIMULADOR DE RED LORAWAN (Neutron Insights)');
console.log('=============================================================');
console.log(`Broker MQTT: ${MQTT_URL}`);
console.log(`Dispositivos activos: ${SENSOR_COUNT}`);
console.log(`Intervalo de transmisión: ${INTERVAL_MS / 1000} segundos (${INTERVAL_MS / 60000} minutos reales)`);
console.log(`Inyección de anomalías: ${INJECT_ANOMALIES ? 'ACTIVADA' : 'DESACTIVADA'}`);
console.log('-------------------------------------------------------------');

// Ubicaciones de prueba en Galicia (Pontevedra y Santiago de Compostela)
const galiciaLocations = [
  { name: 'Sensor Humedad - Lago de Castiñeiras (Pontevedra)', lat: 42.3486, lng: -8.6747 },
  { name: 'Estación Ambiental - Lago de Castiñeiras (Pontevedra)', lat: 42.3495, lng: -8.6738 },
  { name: 'Sensor Nivel Industrial - Polígono da Sionlla (Santiago)', lat: 42.9135, lng: -8.5132 },
  { name: 'Sensor Calidad Aire - Polígono da Sionlla (Santiago)', lat: 42.9142, lng: -8.5120 },
  { name: 'Sensor Agroclimático - Monte Aloia (Pontevedra)', lat: 42.0682, lng: -8.6750 },
];

// Generar lista de sensores simulados
const sensors = [];
for (let i = 1; i <= SENSOR_COUNT; i++) {
  const hexSuffix = i.toString(16).padStart(2, '0');
  const locIndex = (i - 1) % galiciaLocations.length;
  const loc = galiciaLocations[locIndex];
  sensors.push({
    devEui: `00112233445566${hexSuffix}`.toUpperCase(),
    name: SENSOR_COUNT <= 5 ? loc.name : `Sensor LoRaWAN #${i}`,
    baseHumidity: 45 + (i * 6) % 35,
    baseTemp: 18 + (i * 1.5) % 8,
    baseBattery: 3.85 - (i * 0.05),
    lat: loc.lat + (Math.floor(i / galiciaLocations.length) * 0.001),
    lng: loc.lng + (Math.floor(i / galiciaLocations.length) * 0.001),
    fcnt: 100,
  });
}

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `lora_sim_${Math.random().toString(16).substring(2, 8)}`,
});

const transmitUplinks = (tick) => {
  sensors.forEach((sensor, idx) => {
    // 1. Simular fluctuaciones naturales
    let humidity = sensor.baseHumidity + Math.sin(tick * 0.2 + idx) * 5 + (Math.random() * 2 - 1);
    let temperature = sensor.baseTemp + Math.cos(tick * 0.2 + idx) * 3 + (Math.random() * 0.8 - 0.4);
    let battery = Math.max(2.9, sensor.baseBattery - (tick * 0.0005));
    let rssi = -95 - Math.floor(Math.random() * 15);
    let snr = +(7.5 + (Math.random() * 3 - 1.5)).toFixed(1);

    // Inyección periódica de anomalías para probar disparo y resolución de alertas (Histéresis)
    if (INJECT_ANOMALIES && idx === 0) {
      if (tick % 6 >= 3) {
        humidity = 86.4 + Math.random() * 3;
      } else {
        humidity = 65.2;
      }
    }

    if (INJECT_ANOMALIES && idx === 1 && tick % 8 >= 5) {
      humidity = 24.5 - Math.random() * 2;
    }

    sensor.fcnt++;

    // 2. Formatear mensaje como evento ChirpStack v4
    const topic = `application/1/device/${sensor.devEui.toLowerCase()}/event/up`;

    const chirpstackPayload = {
      applicationId: '1',
      deviceInfo: {
        tenantId: '1',
        applicationId: '1',
        deviceProfileId: 'profile-soil-moisture',
        deviceName: sensor.name,
        devEui: sensor.devEui.toLowerCase(),
      },
      time: new Date().toISOString(),
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
        temperature: +temperature.toFixed(2),
        battery: +battery.toFixed(2),
        pressure: 1013.2,
        latitude: sensor.lat,
        longitude: sensor.lng,
      },
      rxInfo: [
        {
          gatewayId: 'AABBCCDDEEFF0011',
          rssi,
          snr,
        },
      ],
    };

    client.publish(topic, JSON.stringify(chirpstackPayload), { qos: 1 });
  });

  console.log(`[${new Date().toLocaleTimeString()}] 📡 Uplinks LoRaWAN enviados para ${sensors.length} sensores (Ciclo #${tick})`);
  console.log(`⏳ Próximo envío programado en ${INTERVAL_MS / 60000} minutos...`);
};

client.on('connect', () => {
  console.log('✅ Conectado exitosamente al broker MQTT Mosquitto');
  console.log('🚀 Enviando primera ráfaga inicial de telemetría...\n');

  let tick = 1;
  transmitUplinks(tick);

  setInterval(() => {
    tick++;
    transmitUplinks(tick);
  }, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error('❌ Error de conexión MQTT:', err.message);
});
