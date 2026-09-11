# CORNEA IoT Platform — Monitorización LoRaWAN Autoalojada & Telemetría Time-Series

Plataforma integral, autoalojada y de alto rendimiento para la monitorización en
tiempo real de redes de sensores LoRaWAN: ingesta MQTT/HTTP, persistencia
time-series en TimescaleDB, motor de alertas con histéresis anti-flapping,
streaming SSE y dashboard multilingüe con mapa geográfico.

Desarrollado por **Neutron Insights**. Licencia MIT.

> **Sensores CORNEA**: sistema de monitorización de humedad por rayos cósmicos.
> Cada sonda mide humedad de suelo, temperatura, presión y batería (Li-ion 1S
> recargada por panel solar), y transmite por radio LoRaWAN.

---

## Tabla de contenidos

1. [Arquitectura y flujo de datos](#1-arquitectura-y-flujo-de-datos)
2. [Estructura del repositorio](#2-estructura-del-repositorio)
3. [Requisitos](#3-requisitos)
4. [Puesta en marcha](#4-puesta-en-marcha)
5. [Comunicación LoRaWAN en detalle](#5-comunicación-lorawan-en-detalle)
6. [Representación de los datos de los sensores](#6-representación-de-los-datos-de-los-sensores)
7. [Frontend (dashboard CORNEA)](#7-frontend-dashboard-cornea)
8. [Backend (API NestJS)](#8-backend-api-nestjs)
9. [Simulador de sensores](#9-simulador-de-sensores)
10. [Ingesta HTTP directa (gateways legacy)](#10-ingesta-http-directa-gateways-legacy)
11. [Panel de administración](#11-panel-de-administración)
12. [Variables de entorno](#12-variables-de-entorno)
13. [Solución de problemas](#13-solución-de-problemas)
14. [Notas conocidas](#14-notas-conocidas)

---

## 1. Arquitectura y flujo de datos

```text
Sonda CORNEA (radio LoRa: humedad, temp, presión, batería)
   │  EU868, OTAA/ABP
   ▼
Gateway LoRaWAN (Semtech UDP :1700 / BasicStation)
   ▼
ChirpStack Gateway Bridge  ──►  ChirpStack v4 (:8080)
   │  MQTT, topic: application/+/device/+/event/up
   ▼
Eclipse Mosquitto 2.x (:1883 MQTT, :9001 websockets)
   │  (o ingesta directa: POST /api/v1/ingest/gateway con X-API-Key)
   ▼
Backend NestJS — worker de ingesta + codec de payloads
   │  valida rangos → auto-aprovisiona DevEUI desconocidos
   ▼
PostgreSQL 16 + TimescaleDB (hypertable `measurements`)
   │  REST /api/v1  +  SSE /api/v1/stream/events
   ▼
Frontend React 18 + Vite (Nginx :3000, proxy /api/ → backend)
```

Puertos publicados por defecto (todos configurables en `.env`):

| Servicio | Puerto host | Descripción |
|---|---|---|
| Frontend (Nginx) | `3000` | Dashboard CORNEA |
| Backend API + Swagger | `8000` | REST (`/api/v1`), docs (`/api/docs`), `/health` |
| ChirpStack v4 | `8080` | Network server LoRaWAN |
| Mosquitto MQTT / WS | `1883` / `9001` | Broker (el backend se suscribe a `application/+/device/+/event/up`) |
| PostgreSQL/TimescaleDB | `5432` | Hypertables y datos relacionales |
| Redis | `6379` | Caché/colas |
| Gateway UDP | `1700/udp` | Entrada de paquetes LoRa desde gateways físicos |

---

## 2. Estructura del repositorio

Todas las rutas son **relativas a la raíz** (sin dependencias de máquina):

```text
.
├── README.md                    # Este documento
├── .env                         # ⚠️ NO se commitea (ver .gitignore). Crear desde .env.example
├── .env.example                 # Plantilla de variables (valores demo)
├── .gitignore                   # Excluye node_modules, dist, .env, logs…
├── docker-compose.yml           # Stack completo (9 servicios, rutas relativas ./docker/…)
│
├── docker/                      # Configuración de infraestructura
│   ├── timescale/init.sql       # Esquema: tenants, users, devices, measurements (hypertable),
│   │                            #   alert_rules, alert_events, notification_logs
│   ├── mosquitto/mosquitto.conf # Listeners :1883 (mqtt) y :9001 (websockets) + auth
│   ├── chirpstack/              # Configuración ChirpStack v4
│   └── chirpstack-gateway-bridge/
│
├── backend/                     # API NestJS 10 + worker (Node 20, TypeScript)
│   ├── Dockerfile               # Build multi-stage (target `runner`)
│   ├── package.json             # Scripts: start:dev, start, start:worker, seed, test
│   └── src/
│       ├── main.ts              # Bootstrap: CORS, validación, Swagger, GET /health
│       ├── worker.ts            # Entrada del worker de ingesta/alertas
│       ├── app.module.ts        # Módulos de la aplicación
│       ├── config/configuration.ts        # Toda la config vía variables de entorno
│       ├── database/            # DatabaseService (pg Pool) + seeds/seed.ts (demo)
│       ├── modules/
│       │   ├── ingestion/       # http-ingest.controller.ts (POST /api/v1/ingest/gateway, X-API-Key)
│       │   │                    # ingestion.service.ts → processRawMessage() / ingestNormalizedUplink()
│       │   │                    # codecs/payload-codec.service.ts → decode() ChirpStack v4 / genérico / binario
│       │   │                    # mqtt-subscriber.service.ts → suscripción al broker
│       │   ├── devices/         # devices.controller.ts + devices.service.ts (estado online/warning/offline)
│       │   ├── telemetry/       # telemetry.controller.ts (:id/measurements, :id/export/csv)
│       │   ├── alerts/          # alerts.controller.ts + alerts-engine.service.ts (histéresis)
│       │   ├── realtime/        # realtime.controller.ts (SSE GET /api/v1/stream/events)
│       │   ├── auth/            # auth.controller.ts (login/refresh/logout, JWT)
│       │   ├── users/           # users.controller.ts (CRUD solo admin)
│       │   └── notifications/   # Webhook / email ante alertas
│       └── shared/              # Guards JWT+roles, decoradores, tipos (NormalizedUplink…)
│
├── frontend/                    # SPA React 18 + Vite 5 + Tailwind + ECharts + Leaflet
│   ├── Dockerfile               # Build → Nginx (proxy /api/ → backend-api:8000)
│   ├── nginx.conf               # SPA fallback + proxy /api/ + gzip + caché
│   ├── vite.config.ts           # Dev en 127.0.0.1:3000 (+ plugin React)
│   ├── .env.example             # Plantilla VITE_API_URL (copiar a .env en local)
│   ├── public/
│   │   └── LEEME-logo.md        # Instrucciones: colocar aquí logo.png 703×703 con transparencia
│   └── src/
│       ├── main.tsx / App.tsx   # Entrada + rutas protegidas por rol
│       ├── api/client.ts        # Axios → VITE_API_URL (defecto http://localhost:8000/api/v1) + JWT
│       ├── context/             # ThemeContext (claro/oscuro) + LanguageContext (11 idiomas, RTL árabe)
│       ├── hooks/               # useAuth.tsx (JWT en localStorage) + useRealtime.ts (SSE + reconexión 4s)
│       ├── i18n/translations.ts # 195 claves × 11 idiomas (es,en,gl,zh,hi,fr,ar,pt,de,ru,it)
│       ├── utils/               # battery.ts (V→% Li-ion 3.0–4.2V) + labels.ts (estados/severidades)
│       ├── components/
│       │   ├── layout/          # AppLayout, Navbar (selector idioma sin banderas), Sidebar, Logo
│       │   ├── charts/          # TelemetryChart (ECharts, leyenda traducida)
│       │   └── map/             # SensorMap (react-leaflet + OpenStreetMap, zoom con rueda)
│       └── pages/               # Login, Dashboard, DevicesList, DeviceDetail,
│                                #   MapView, AlertsView, AdminView
│
└── simulator/                   # Generador de tráfico LoRaWAN sin hardware (Node + mqtt)
    ├── Dockerfile               # Imagen del servicio `simulator` (auto-arranque en compose)
    ├── package.json             # start (30 min), simulate:30min/5min/anomalies/fast/neutrons/load-test
    ├── mock-lora-devices.js     # Sensores virtuales → ChirpStack v4 JSON → MQTT
    │                            # (+ modo --neutrons: N_raw con ruido Poisson; intervalo vía
    │                            # INTERVAL_MS/SENSOR_COUNT/NEUTRON_MODE/INJECT_ANOMALIES o flags CLI)
    └── readme.md                # Documentación propia del simulador
```

---

## 3. Requisitos

### Opción A — Stack completo con Docker (recomendado para probar)

- **Docker Engine 24+** y **Docker Compose v2** (`docker compose version`).
- Puertos libres: `3000, 8000, 8080, 1883, 9001, 5432, 6379, 1700/udp`.
- ~2 GB RAM libres para los 9 contenedores.

### Opción B — Desarrollo local por piezas

- **Node.js 20+** y npm (frontend, backend y simulador).
- Servicios externos (o vía `docker compose up postgres redis mosquitto`):
  - PostgreSQL 16 + TimescaleDB en `localhost:5432`.
  - Redis en `localhost:6379` (opcional según uso).
  - Mosquitto en `localhost:1883` (para el simulador/MQTT).

---

## 4. Puesta en marcha

### 4.1. Todo con Docker (1 comando)

```powershell
# 1. Clonar y entrar (ruta relativa a donde lo clones)
git clone <URL-del-repo> cornea
cd cornea

# 2. Variables de entorno (los valores demo ya vienen listos)
cp .env.example .env

# 3. Construir y levantar el stack
docker compose up -d --build

# 4. Sembrar datos demo (OBLIGATORIO la primera vez o tras `down -v`).
#    Se usa `npm --prefix` para que funcione igual en PowerShell, cmd y bash.
npm --prefix backend install
npm --prefix backend run seed

# 5. Ver estado / logs
docker compose ps
docker compose logs -f backend-api
```

> Sin el paso 4 la tabla `users` queda vacía y el login devuelve
> `401 Credenciales inválidas` aunque todos los contenedores estén en verde
> (el `init.sql` solo crea el esquema; el seed crea usuarios, sondas, reglas
> e histórico de 48 h).
>
> El seed (`backend/src/database/seeds/seed.ts`, reejecutable) registra las
> 5 sondas como **«Sonda 0X · \<lugar reconocible\>»** (código numérico del
> DevEUI + identificativo) con umbrales agronómicos de Galicia **20–65 %**;
> al reejecutarlo actualiza nombres y umbrales de las ya existentes.

Abrir:
- Dashboard: <http://localhost:3000> (admin@example.com / admin123456)
- Swagger API: <http://localhost:8000/api/docs>
- ChirpStack: <http://localhost:8080>

> El contenedor `frontend` sirve la build de producción y redirige `/api/*`
> al backend interno, así que no necesita `VITE_API_URL` del navegador.

### 4.2. Desarrollo local (frontend + backend + simulador por separado)

```bash
# --- Backend API (terminal 1) ---
cd backend
npm install
npm run start:dev        # http://localhost:8000 (+ /api/docs, /health)

# --- Worker de ingesta (terminal 2, opcional si se usa MQTT) ---
cd backend
npm run start:worker

# --- Frontend (terminal 3) ---
cd frontend
npm install
cp .env.example .env     # apunta a http://localhost:8000/api/v1
npm run dev              # http://localhost:3000 (Vite, con HMR)

# --- Simulador (terminal 4) ---
cd simulator
npm install
npm run simulate:fast    # 5 sensores cada 5 s con anomalías → verás datos en vivo
```

> Requiere Postgres/TimescaleDB, Redis y Mosquitto accesibles (levántalos con
> `docker compose up -d postgres redis mosquitto` si no los tienes en local).
> Para crear el esquema y los datos demo: `npm --prefix backend run seed`
> (`--prefix` ejecuta el script en esa carpeta y funciona igual en
> PowerShell, cmd y bash).

### 4.3. Credenciales demo (seed)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@example.com` | `admin123456` |
| Operator | `operator@example.com` | `operator123` |
| Viewer | `viewer@example.com` | `viewer123` |

---

## 5. Comunicación LoRaWAN en detalle

### 5.1. Camino del dato (uplink)

1. **Radio (sonda → gateway)**. La sonda CORNEA emite en EU868 un uplink con
   humedad de suelo (%), temperatura (°C), presión (hPa) y batería (V). El
   gateway lo reenvía por UDP (`1700/udp`) o BasicStation.
2. **ChirpStack Gateway Bridge → ChirpStack v4** (`docker/chirpstack*`,
   UI en `:8080`). El network server publica el evento en MQTT:

   ```text
   application/<appId>/device/<devEui>/event/up     (QoS 1)
   ```

   Suscripción del backend: `MQTT_TOPIC_SUBSCRIPTION`
   (`application/+/device/+/event/up`), configurada en `.env` y
   `backend/src/config/configuration.ts` → `mqtt.topicSubscription`.
3. **Mosquitto** (`docker/mosquitto/mosquitto.conf`): listener MQTT `:1883`
   con usuario/contraseña, y listener **websockets `:9001`** (usado por el
   panel Admin para comprobar que el broker está vivo desde el navegador).
4. **Worker/backend NestJS**:
   - `backend/src/modules/ingestion/mqtt-subscriber.service.ts` — consume el topic.
   - `backend/src/modules/ingestion/codecs/payload-codec.service.ts` —
     `decode()` acepta 3 formatos:
     - **ChirpStack v4 JSON** (`deviceInfo.devEui` + `object` ya decodificado
       y/o `data` base64),
     - **JSON genérico** (`devEUI`/`devEui` + `humidity/temperature/battery/pressure/lat/lon/rssi/snr`),
     - **Binario compacto** (6 bytes big-endian: humedad×0.1, temp×0.1, batería×0.001 V).
   - **Vía neutrónica CRNS**: si el payload trae `neutron_counts` (alias
     `neutrons`, `n_raw`, `neutron_count`), el codec calcula la humedad con el
     modelo Geant4 calibrado — **válido para todas las sondas por igual** — e
     ignora la humedad directa:
     1. `fp = exp((P₀ − P) / L)` con `P₀ = 981.4 hPa`, `L = 137.0`
        (`cornea_pipeline/engine/corrections.py` en el proyecto de referencia);
     2. `N_corr = N_raw · fp`; `ratio = N_corr / N₀` con `N₀ = 143.0`;
     3. `θ(%) = a₀·e^(−a₁·ratio) + a₂` con `a₀ = 107.381…`, `a₁ = 3.036…`,
        `a₂ = −4.894…` (clamp 0–100).
   - **Calibración maestra**: `cornea_pipeline/config/calibration_config.json`
     (en este repo), montado en los contenedores del backend como
     `/cornea_pipeline/config/calibration_config.json` (`docker-compose.yml`).
     El backend lo relee en cada cálculo (`getCalibrationConfig()`); si falta,
     usa estos mismos valores como fallback. Al recalibrar en Geant4 basta
     actualizar el JSON (sin reconstruir la imagen).
   - **Suavizado EMA**: `ingestion.service.ts` aplica por dispositivo
     `θ_suav = 0.3·θ_inst + 0.7·θ_prev` (α = 0.3) contra el ruido de Poisson;
     se persiste la humedad **suavizada**, las alertas se evalúan sobre ella y
     el SSE difunde `neutron_counts` junto a la telemetría.
   - **Coherencia total**: si el uplink trae humedad sin neutrones, el codec
     estima N con la inversa (`estimateNeutronsFromHumidity()`); ningún
     registro nuevo queda con campos vacíos.
   - **Ingesta única y a prueba de duplicados**: solo el worker se suscribe a
     MQTT (`MQTT_SUBSCRIBE=false` en la API); el INSERT lleva
     `ON CONFLICT DO NOTHING` sobre `(device_id, time)`.
   - **Salud MQTT**: `GET /api/v1/system/mqtt-status` (solo admin, módulo
     `system/`) comprueba el broker por TCP desde el backend.
   - `backend/src/modules/ingestion/ingestion.service.ts`:
     - `processRawMessage()` → `ingestNormalizedUplink()` produce un
       `NormalizedUplink` (`shared/types`),
     - `validatePhysicalRanges()`: humedad 0–100, temp −50…90, presión
       700–1200, batería 0–15 V,
     - auto-aprovisiona DevEUIs desconocidos (`autoProvisionDevice()`),
     - inserta en la hypertable `measurements`,
     - `alerts-engine.service.ts → evaluateUplink()` dispara/resuelve reglas,
     - `realtime.broadcastMeasurement()` emite el evento SSE.
5. **Vía HTTP directa** (gateways legacy sin LoRaWAN):
   `POST /api/v1/ingest/gateway` con cabecera `X-API-Key`
   (`backend/src/modules/ingestion/http-ingest.controller.ts`, clave
   `API_KEY_INGEST`). Mismo pipeline desde `processRawMessage()`. El panel
   Admin incluye un probador con ambos formatos y generador de cURL.

### 5.2. Formato de mensaje (ejemplo ChirpStack v4)

```json
{
  "deviceInfo": { "devEui": "0011223344556601", "deviceName": "Sonda 01" },
  "time": "2026-09-08T10:30:45.123Z",
  "fCnt": 101, "fPort": 2,
  "object": { "humidity": 68.42, "temperature": 23.15, "battery": 3.84,
              "pressure": 1013.2, "latitude": 42.3486, "longitude": -8.6747 },
  "rxInfo": [{ "gatewayId": "AABBCCDDEEFF0011", "rssi": -98, "snr": 8.2 }]
}
```

### 5.3. Motor de alertas con histéresis

`backend/src/modules/alerts/alerts-engine.service.ts`:
- `evaluateRule()` compara la métrica (`humidity|temperature|battery|rssi|snr`)
  con `condition` (`> >= < <= == !=`) y `threshold`.
- Estados: `triggered → acknowledged → resolved`. La resolución exige salir
  de la banda de histéresis (`checkHysteresisResolution()`), evitando flapping.
- Reglas seed en `backend/src/database/seeds/seed.ts`: humedad fuera de
  **15–85 %** (`<= 15` critical, `>= 85` warning), batería baja, RSSI débil.
  El seed es idempotente: normaliza por métrica+condición, elimina duplicadas
  sin eventos y solo inserta las que falten (antes se duplicaban al reejecutar
  porque `alert_rules` no tenía restricción única).
- **Ingesta única**: API y worker comparten `AppModule`, pero solo el worker
  se suscribe a MQTT (`MQTT_SUBSCRIBE=false` en `backend-api`). Sin esto cada
  uplink se insertaba dos veces.

---

## 6. Representación de los datos de los sensores

### 6.1. Persistencia (TimescaleDB)

Esquema en `docker/timescale/init.sql`. Tabla principal:

```sql
measurements(time, device_id, humidity, temperature, pressure, battery,
             latitude, longitude, rssi, snr, gateway_id, fcnt_up,
             raw_payload, valid,
             neutron_counts,      -- N_raw del detector CRNS (cuantos, NULL si no aplica)
             CONSTRAINT uq_measurements_device_time UNIQUE (device_id, time))
                                   -- hypertable particionada por time
```

> Migraciones idempotentes en `docker/timescale/migrations/` (aplicar en BD
> ya creadas, en orden):
>
> ```powershell
> Get-Content docker/timescale/migrations/002_add_neutron_counts.sql -Raw |
>   docker exec -i cornea_postgres psql -U iot -d iot
> Get-Content docker/timescale/migrations/003_unique_measurement.sql -Raw |
>   docker exec -i cornea_postgres psql -U iot -d iot
> Get-Content docker/timescale/migrations/004_unique_tenant_name.sql -Raw |
>   docker exec -i cornea_postgres psql -U iot -d iot
> ```
>
> - `002`: añade `neutron_counts`.
> - `003`: elimina duplicados exactos y crea la unicidad `(device_id, time)`
>   (el INSERT de ingesta lleva `ON CONFLICT DO NOTHING`).
> - `004`: elimina tenants duplicados huérfanos y fija `UNIQUE(name)` para
>   que el seed no los multiplique.
> - `005`: estima N en filas históricas con humedad pero sin neutrones
>   (inversa Geant4), para coherencia total de registros antiguos.

Tablas de apoyo: `tenants`, `users`, `devices` (umbrales
`humidity_min/max_threshold`, `battery_threshold`, `last_seen_at`),
`alert_rules`, `alert_events`, `notification_logs`.

### 6.2. Estado de cada sonda

`backend/src/modules/devices/devices.service.ts` (`findAll`/`findOne`) calcula:

- `offline` si está deshabilitada o sin datos > 15 min,
- `warning` si hay alertas activas o batería bajo umbral,
- `online` en otro caso,
- más `latest_*` (última medición) y `active_alerts`.

### 6.3. Batería: de voltios a porcentaje

Las sondas llevan Li-ion 1S + panel solar (rango 3.0–4.2 V).
`frontend/src/utils/battery.ts`:

```ts
batteryPercent(V) = clamp((V − 3.0) / (4.2 − 3.0) × 100)   // ej. 3.82 V → 68 %
```

Se muestra como `3.82V · 68 %` en Dashboard (`src/pages/Dashboard.tsx`),
listado (`DevicesList.tsx`) y ficha (`DeviceDetail.tsx`, con barra de nivel).
El KPI «Batería Baja» usa `isLowBattery()`: umbrales **> 15 se leen como %**
(20 = 20 %), **≤ 15 como voltios**. Ver [Notas conocidas](#14-notas-conocidas).

### 6.4. Tiempo real y exportación

- **SSE**: `GET /api/v1/stream/events`
  (`backend/src/modules/realtime/realtime.controller.ts`); el hook
  `frontend/src/hooks/useRealtime.ts` reconecta cada 4 s y alimenta el
  indicador «Tiempo Real Activo» del Navbar.
- **Histórico**: `GET /api/v1/devices/:id/measurements?from&to&interval`
  (siempre `raw` desde la UI: con cadencia de 30 min, 30 días son 1440 puntos;
  el backend devuelve como máximo los 5000 más recientes) → gráfico ECharts
  con **humedad %, temperatura y neutrones**
  (`frontend/src/components/charts/TelemetryChart.tsx`, leyenda con scroll
  inferior y ejes cortos `% / °C` y `N` para responsive). Rangos: **8h / 24h /
  30d / registro completo**, con carga bajo demanda al seleccionarlos. El eje
  temporal es real (`type: time`): cada registro es un punto posicionado por
  su instante (equiespaciados a 30 min; pausas y desconexiones se ven como
  huecos, sin unir con línea) y el zoom de rueda/slider separa los puntos.
- **CSV**: `GET /api/v1/devices/:id/export/csv` (botón en la ficha).
- **Mapa**: `frontend/src/components/map/SensorMap.tsx` (react-leaflet +
  OpenStreetMap en ambos temas, zoom con rueda, popup por sonda).
- **Física CRNS en la ficha** (`frontend/src/pages/DeviceDetail.tsx`):
  tarjeta **N_raw (cuantos)** con el último recuento (vía REST
  `latest_neutron_counts` —último N no nulo— o SSE en vivo). La tabla de
  histórico muestra Fecha/Hora, Humedad, **Neutrones**, Temperatura, Batería,
  Presión, RSSI y Muestras. El histórico expone `neutron_counts` (raw) y
  `avg_neutron_counts` (buckets) y el CSV incluye ambas columnas.
  Coherencia total: si un uplink trae humedad sin neutrones, el backend
  estima N con la inversa del modelo (misma fórmula); si trae neutrones,
  calcula θ. Ningún registro nuevo queda con campos vacíos.

---

## 7. Frontend (dashboard CORNEA)

- **Arranque**: `src/main.tsx` → `App.tsx` (rutas `/login`, `/`, `/devices`,
  `/devices/:id`, `/map`, `/alerts`, `/admin` con guardias por rol).
- **Layout**: `components/layout/` — `AppLayout`, `Navbar` (hamburger en móvil,
  tema, idioma sin banderas, campana de alertas), `Sidebar` (escritorio) +
  drawer móvil con las mismas opciones, `Logo` (lee `/logo.png` de `public/`;
  ver `public/LEEME-logo.md` para el PNG 703×703 con transparencia).
  Responsive: grids adaptativos, tablas con scroll-x, badges sin saltos
  (`whitespace-nowrap`, 9px) y `ErrorBoundary` raíz ante fallos de render.
- **Estado global**: `context/ThemeContext.tsx` (claro/oscuro, persiste en
  `localStorage`) y `context/LanguageContext.tsx` (11 idiomas + RTL árabe).
- **i18n**: `src/i18n/translations.ts` — **199 claves × 11 idiomas**
  (`es en gl zh hi fr ar pt de ru it`); `src/utils/labels.ts` traduce estados
  (`triggered…`) y severidades; los filtros y badges nunca muestran claves.
- **Auth**: `hooks/useAuth.tsx` (JWT `cornea_jwt` + usuario `cornea_user`);
  `api/client.ts` inyecta el token y redirige a `/login` ante 401.
- **Contraste modo claro**: estilos base en `src/index.css` (texto oscuro sobre
  fondos claros en todos los componentes) + paleta en `tailwind.config.js`.

---

## 8. Backend (API NestJS)

Base: `http://localhost:8000` · Swagger: `/api/docs` · Health: `GET /health`
(`src/main.ts`, sin auth). Auth JWT en el resto (`Authorization: Bearer …`),
roles `admin|operator|viewer` (`shared/guards/`).

| Método | Ruta | Roles | Descripción (fichero) |
|---|---|---|---|
| POST | `/api/v1/auth/login` | — | Login → `{accessToken, user}` (`auth/`) |
| POST | `/api/v1/auth/refresh` | auth | Renovar JWT |
| POST | `/api/v1/auth/logout` | auth | Cierre (cliente borra token) |
| GET | `/api/v1/devices` | auth | Lista + estado + últimas métricas (`devices/`) |
| GET | `/api/v1/devices/latest` | auth | Últimas métricas compactas |
| GET/POST/PATCH/DELETE | `/api/v1/devices[/:id]` | ver/＋admin,operator/＋admin | CRUD sensores |
| GET | `/api/v1/devices/:id/measurements` | auth | Histórico agregado (`telemetry/`) |
| GET | `/api/v1/devices/:id/export/csv` | auth | Descarga CSV |
| GET/POST/PATCH/DELETE | `/api/v1/alert-rules[/:id]` | ver/＋admin,operator/＋admin | Reglas (`alerts/`) |
| GET | `/api/v1/alert-events` | auth | Incidentes |
| POST | `/api/v1/alert-events/:id/acknowledge` | admin,operator | Reconocer |
| GET/POST/PATCH/DELETE | `/api/v1/users[/:id]` | **admin** | CRUD usuarios (`users/`) |
| POST | `/api/v1/ingest/gateway` | `X-API-Key` | Ingesta HTTP (`ingestion/`) |
| GET (SSE) | `/api/v1/stream/events` | — | Eventos realtime (`realtime/`) |

Scripts (`backend/package.json`): `start:dev` (API con recarga), `start:worker`
(worker MQTT/alertas), `start`/`start:prod` (desde `dist/` tras `build`),
`seed` (usuarios + 5 sondas demo + reglas + 48 h de histórico), `test` (jest;
`alerts-engine.service.spec.ts` cubre la histéresis).

---

## 9. Simulador de sensores

Sin hardware: `simulator/mock-lora-devices.js` (Node + `mqtt`) publica eventos
ChirpStack v4 en `application/1/device/<devEui>/event/up` con 5 ubicaciones
reales de Galicia, deriva de batería (3.85 V → mín. 2.9 V), RSSI/SNR realistas
y anomalías programadas para probar la histéresis. Detalle completo en
`simulator/readme.md`.

```powershell
npm --prefix simulator install
npm --prefix simulator run simulate:fast      # 5 sondas cada 5 s + anomalías (ideal para demo)
npm --prefix simulator run simulate:anomalies
npm --prefix simulator run simulate:neutrons  # modo CRNS explícito (ahora es el defecto)
npm --prefix simulator run load-test          # 100 sondas cada 2 s (carga)
```

```bash
# Ejemplo avanzado (ejecutar dentro de simulator/):
node mock-lora-devices.js --count 20 --interval 10000 --url mqtt://<broker>:1883 --user iot --pass changeme
```

> Desde la v2 el simulador envía **neutrones por defecto** (opt-out con
> `--no-neutrons` o `NEUTRON_MODE=false`); si un uplink trae humedad sin N,
> el backend estima N con la inversa Geant4. Con Docker no hace falta
> arrancarlo a mano: el servicio `simulator` del compose (modo neutrónico +
> anomalías cada 30 min, como las sondas físicas) envía al conectar un
> **backfill de 10 muestras históricas** por sonda y la primera ráfaga en
> vivo, así que gráfica y tarjeta N_raw se rellenan solas al levantar el
> stack. `SIM_INTERVAL_MS` lo acelera y `SIM_BACKFILL` ajusta el histórico
> inicial (idempotente gracias a la unicidad).

> `npm --prefix <carpeta>` funciona igual en PowerShell, cmd y bash, sin
> necesidad de `cd` ni de `&&` (no soportado en PowerShell 5.1).

Variables: `MQTT_URL` (def. `mqtt://localhost:1883`), `MQTT_USERNAME`,
`MQTT_PASSWORD` o flags `--url/--user/--pass/--count/--interval/--anomalies`.

---

## 10. Ingesta HTTP directa (gateways legacy)

```bash
curl -X POST http://localhost:8000/api/v1/ingest/gateway \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret_ingest_key_for_http_gateways_123456" \
  -d '{"devEui":"0011223344556601","humidity":72.5,"temperature":23.4,
       "battery":3.82,"pressure":1013.2,"latitude":42.3486,
       "longitude":-8.6747,"rssi":-96,"snr":8.0}'
# → 202 {"status":"accepted", ...}  (401 si la clave es inválida)
```

El mismo envío puede hacerse desde **Administración → Probador de Ingesta**
(formato ChirpStack v4 o JSON simple, con generador de cURL). El campo
opcional **N_raw (cuantos)** hace que el backend calcule θ con el modelo
Geant4 en lugar de usar la humedad del formulario (válido para cualquier
sonda). Nuevo endpoint de sistema: `GET /api/v1/system/mqtt-status`
(solo admin) → `{online, latencyMs, host}`.

---

## 11. Panel de administración

Ruta `/admin` (solo rol `admin`), `frontend/src/pages/AdminView.tsx`, en este orden:

1. **Estado de Servicios & Topología Backend** — checks en vivo con latencia:
   API (`/health`), TimescaleDB (query vía `/devices`) y Mosquitto (vía
   `GET /api/v1/system/mqtt-status`, comprobación TCP desde el backend —
   fiable desde cualquier navegador), con botón de re-chequeo.
2. **Usuarios con Acceso** — tabla + **crear** (email, contraseña ≥ 6, rol,
   estado), **editar** (rol/estado/contraseña opcional) y **eliminar** (la
   cuenta propia está protegida).
3. **Probador de Ingesta HTTP Gateway** — descrito arriba.

---

## 12. Variables de entorno

Copiar `cp .env.example .env` y ajustar. Las más relevantes:

| Variable | Defecto | Uso |
|---|---|---|
| `POSTGRES_*` / `DATABASE_URL` | `iot/changeme…@postgres:5432` | Backend ↔ TimescaleDB |
| `MQTT_URL` / `MQTT_USERNAME` / `MQTT_PASSWORD` | `mqtt://mosquitto:1883`, `iot` | Backend worker + simulador |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | demo / `24h` | **Cambiar en producción** |
| `API_KEY_INGEST` | `secret_ingest_key_…` | Cabecera `X-API-Key` de ingesta |
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Frontend dev (en Docker se usa `/api/v1` vía Nginx) |
| `FRONTEND_PORT` / `API_PORT` | `3000` / `8000` | Puertos publicados |
| `SMTP_*` / `ALERT_WEBHOOK_URL` | — | Notificaciones (opcional) |

`.env` está en `.gitignore` y **no debe subirse a GitHub** (sí los
`.env.example`). Lo mismo para `**/node_modules/`, `**/dist/` y `*.log`.

---

## 13. Solución de problemas

| Síntoma | Causa probable | Acción |
|---|---|---|
| Login `401 Credenciales inválidas` con stack en verde | Volumen de Postgres fresco sin seed (`users` vacía) | `npm --prefix backend install` + `npm --prefix backend run seed` (solo la primera vez) |
| Pantalla en negro al llegar una alerta | (Corregido) El SSE enviaba claves `camelCase` y el formateo de fechas lanzaba sin red de seguridad | `utils/realtime.ts` normaliza el evento, `utils/dates.ts` nunca lanza y `components/ErrorBoundary.tsx` muestra panel de recuperación |
| `Port 3000 is in use` en `npm run dev` | Otro proceso/contenedor ocupa el 3000 | `netstat -ano \| findstr :3000` y libera, o usa el puerto alternativo que propone Vite |
| Página en blanco tras `npm run dev` | Faltaba el plugin React / módulos vacíos (ya corregido) | `npm install` + recargar; revisa la consola del navegador |
| Tarjeta N_raw en `--` | No hay tráfico neutrónico reciente y tampoco histórico con N | El servicio `simulator` de Docker ya envía neutrones solo; en manual usar `simulate:neutrons`. Desde la v2 el simulador trae neutrones por defecto y el backend estima N si falta, así que todo registro nuevo es completo |
| Dos simuladores a la vez mezclan tráficos | Un simulador en host (humedad) + el servicio `simulator` (neutrones) compiten: el `latest` salta de uno a otro y el EMA mezcla ambos | Quedarse con uno solo: detener el de host (Ctrl+C) o pasarlo a `--neutrons`. `latest_neutron_counts` devuelve el último N no nulo aunque el tráfico sea mixto |
| Login 401 / redirección a `/login` | Token caducado o backend caído | Comprueba `docker compose ps` y `:8000/health` |
| Sin datos en tiempo real | Mosquitto caído o SSE bloqueado | Admin → Estado de servicios; `docker compose logs mosquitto backend-worker` |
| Simulador `connack timeout` | Broker inaccesible / credenciales | Verifica `:1883`, `MQTT_USERNAME/PASSWORD` o flags `--user/--pass` |
| Mapa oscuro pide API key | Proveedor Carto con key (ya corregido) | Ambas temas usan OpenStreetMap |
| `docker compose up` falla por `.env` | Falta el fichero | `cp .env.example .env` primero |

---

## 14. Notas conocidas

- **Umbral de batería**: el seed histórico usa `battery_threshold = 20`
  (pensado como **%**), mientras el backend compara voltios en crudo. El
  frontend lo compensa (`> 15` ⇒ %; si no ⇒ V) y muestra el % estimado. Para
  una corrección sistémica habría que unificar la semántica a % en
  `devices.service.ts` + `alerts-engine.service.ts` y reconstruir la imagen.
- **Logo**: colocar `logo.png` (703×703, transparente) en `frontend/public/`.

---

## Licencia

MIT — Neutron Insights (proyecto CORNEA).
