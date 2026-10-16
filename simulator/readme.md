# 📡 CORNEA IoT — Simulador de Sensores LoRaWAN (neutrones CRNS)

Simulador de **sensores CORNEA** que publica eventos LoRaWAN (ChirpStack v4) en
un broker MQTT para pruebas de integración. **CORNEA by Neutron Insights.**

> ⚛️ **Principio de diseño:** el simulador se comporta como una sonda CRNS real,
> es decir **mide y transmite conteos de neutrones, NO humedad**. La humedad
> volumétrica (θ) la calcula **la app** (backend) con el modelo Geant4
> calibrado a partir del recuento y de la presión del propio sensor.

---

## 📖 Modelo físico (por qué no se manda humedad)

Un detector CRNS cuenta neutrones cósmicos; los neutrones se **absorben** en el
agua del suelo, así que **a más neutrones, menos humedad**. La sonda nunca conoce
su humedad: solo mide N.

Flujo real del sistema:

```text
Sonda: mide N_raw (con ruido Poisson) + presión, temperatura, batería, GPS
   │  MQTT  application/1/device/<devEui>/event/up
   ▼
Backend (codec): fp = exp((P0-P)/L) · N_corr = N_raw·fp
   │             θ = a0·e^(-a1·N_corr/N0) + a2      ← Geant4 calibrado
   ▼
App: guarda θ, evalúa alertas (15-85 %), dibuja gráficas y dispara SSE
```

Constantes (`cornea_pipeline/config/calibration_config.json`, R²=0.9687):
`N0=143`, `a0=107.381`, `a1=3.0362`, `a2=-4.8942`, `P0=981.4`, `L=137`.

**Valores de referencia** (P≈1013 hPa):

| N_raw | θ (humedad) | Efecto |
|---|---|---|
| 8-10 | 86-88 % | aviso (regla `humidity >= 85`) |
| 15-60 | 30-72 % | normal, sin alerta |
| 102-110 | 12-14 % | alarma (regla `humidity <= 15`) |

---

## ⚡ Características

- 🌍 **Red fija de 3 sensores CORNEA** (Sionlla, Castiñeiras, Aloia) con los
  mismos DevEUI que el seed del backend.
- ☢️ **Solo neutrones**: el payload no lleva `humidity` ni binario de humedad.
- 📉 **Relación inversa N↔θ** garantizada: más N ⇔ menos humedad.
- 🎲 **Ruido Poisson** (dispersión ~√N) como único azar del detector.
- 🚨 **Excursiones excepcionales**: 1 mensaje anómalo cada 20 por sensor.
- ⏱️ **Cadencia configurable**: de 5 s (demo) a 30 min (como las sondas reales).
- 📦 **Backfill** de 10 muestras previas al conectar (gráfica lista de salida).
- 🐳 Servicio `simulator` en `docker-compose.yml` (perfil `sim-legacy`).
- 🔐 Autenticación MQTT (`--user` / `--pass`).

> La emisión en producción la hace el **simulador gestionable** del panel admin
> (Administración → *Herramientas de desarrollo* → *Simulador de datos de
> prueba*). Este script es el equivalente por terminal.

---

## 🛠️ Requisitos

- **Node.js** >= 18
- Broker **Mosquitto** accesible (el del compose: `mqtt://mosquitto:1883`)

## 📥 Instalación

```bash
cd simulator
npm install
```

## ⚙️ Configuración

```env
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=iot
MQTT_PASSWORD=changeme

SENSOR_COUNT=3          # red fija (valores >3 se ignoran con aviso)
INTERVAL_MS=1800000     # 30 min, como las sondas físicas
INJECT_ANOMALIES=true   # 1 excursión cada 20
SIM_BACKFILL=10         # muestras históricas al arrancar
```

Las variables de entorno tienen prioridad sobre los flags CLI.

---

## 🚀 Uso

```bash
npm start                  # 3 CORNEA cada 30 min (modo sondas reales)
npm run simulate:fast      # cada 5 s (demo en vivo)
npm run simulate:5min      # cada 5 min
npm run load-test          # ráfaga cada 2 s

# Flags directos
node mock-lora-devices.js --interval 10000 --url mqtt://broker:1883
```

| Flag | Defecto | Descripción |
|---|---|---|
| `--url` | `mqtt://localhost:1883` | Broker MQTT |
| `--user` / `--pass` | `iot` / `changeme` | Credenciales |
| `--count` | `3` | Red fija CORNEA (se ignora >3) |
| `--interval` | `1800000` | Cadencia en ms |
| `--anomalies` | activo | Excursiones 1/20 (`INJECT_ANOMALIES=false` las desactiva) |
| `--backfill` | `10` | Muestras previas por sensor |

> Ya no existe `--neutrons` / `--no-neutrons`: **todos** los mensajes llevan
> neutrones, porque es lo que hace el sensor real.

---

## 🔍 Funcionamiento

**1. Perfiles** (`baseNeutrons` = recuento base, NO humedad):

| DevEUI | Sensor | base N | Régimen |
|---|---|---|---|
| `…6601` | CORNEA 01 · Polígono da Sionlla | 34 | aviso (1/20) |
| `…6602` | CORNEA 02 · Lago de Castiñeiras | 40 | alarma (1/20) |
| `…6603` | CORNEA 03 · Monte Aloia | 32 | siempre normal |

**2. Escenario (espacio N)**

```javascript
normal = clamp(baseNeutrons + sin(tick·0.2+idx)·4 + ruido, 15, 60)
// 1 de cada 20 (escalonado: 01 en tick%20==0, 02 en tick%20==10)
mojado  → N = 8 + rand·2      // θ 86-88 %  → aviso
seco    → N = 102 + rand·8    // θ 12-14 %  → alarma
```

**3. Medida (ruido Poisson)**

```javascript
neutron_counts = round(N_objetivo + gauss()·sqrt(N_objetivo))   // |ΔN| ≈ √N
```

**4. Payload** (topic `application/1/device/<devEui>/event/up`)

```json
{
  "applicationId": "1",
  "deviceInfo": {
    "tenantId": "1", "applicationId": "1",
    "deviceProfileId": "profile-soil-moisture",
    "deviceName": "CORNEA 02 - Lago de Castiñeiras (Pontevedra)",
    "devEui": "0011223344556602"
  },
  "time": "2026-09-22T09:30:00.000Z",
  "fCnt": 101,
  "fPort": 2,
  "object": {
    "neutron_counts": 38,
    "temperature": 18.4,
    "battery": 3.87,
    "pressure": 1013.1,
    "latitude": 42.3486,
    "longitude": -8.6747
  },
  "rxInfo": [{ "gatewayId": "AABBCCDDEEFF0011", "rssi": -98, "snr": 7.9 }]
}
```

👉 **No hay `humidity` ni campo `data` binario**: es exactamente lo que
transmite una sonda CRNS. La app deriva θ de `neutron_counts` + `pressure`.

---

## 🐳 Con Docker

```powershell
docker compose --profile sim-legacy up -d simulator   # solo si lo necesitas
docker compose logs -f simulator
```

Desde el panel admin no hace falta terminal: el simulador gestionable emite los
mismos uplinks (con perfiles editables y frecuencia en segundos).

---

## ❓ Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| `connack timeout` | Broker no accesible | `netstat -ano \| findstr :1883`; revisa `MQTT_URL` |
| `Connection refused` | Credenciales | `MQTT_USERNAME` / `MQTT_PASSWORD` |
| No hay datos nuevos | Intervalo largo | Baja `--interval` a 5000 para probar |
| θ siempre ~0 o 100 | `pressure` absurda | Debe estar entre 980-1020 hPa |

Verificar el tráfico MQTT:

```bash
npx mqtt-cli sub -t 'application/1/device/+/event/up' -h localhost -u iot -P changeme
```

---

## 📝 Licencia

MIT — Neutron Insights (proyecto CORNEA IoT).