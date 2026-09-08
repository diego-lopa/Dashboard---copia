# 📡 CORNEA IoT - Simulador de Sensores LoRaWAN

Simulador de dispositivos y gateways LoRaWAN para pruebas de integración con **ChirpStack v4** y **Mosquitto MQTT Broker**. Desarrollado por Neutron Insights.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Funcionamiento Detallado](#funcionamiento-detallado)
- [Estructura del Payload](#estructura-del-payload)
- [Referencia de Comandos](#referencia-de-comandos)
- [Solución de Problemas](#solución-de-problemas)

---

## 📖 Descripción

Este simulador emula el comportamiento de sensores IoT reales que se comunican mediante el protocolo **LoRaWAN**. Genera telemetría (temperatura, humedad, batería, etc.) y la publica en un broker MQTT siguiendo el formato de eventos de **ChirpStack v4**, permitiendo probar y validar plataformas IoT sin necesidad de hardware físico.

### Casos de Uso

- ✅ Pruebas de integración con ChirpStack
- ✅ Validación de pipelines de datos IoT
- ✅ Desarrollo de dashboards y visualizaciones
- ✅ Testing de sistemas de alertas y anomalías
- ✅ Pruebas de carga y escalabilidad

---

## ⚡ Características

- 🌍 **Sensores realistas**: Simula hasta 100+ dispositivos con ubicaciones en Galicia (Pontevedra y Santiago)
- 📊 **Datos variables**: Genera fluctuaciones naturales en temperatura, humedad y batería
- 🚨 **Inyección de anomalías**: Modo para probar sistemas de detección de fallos
- 🔄 **Intervalos configurables**: Desde milisegundos (testing) hasta minutos (producción)
- 📡 **Compatible con ChirpStack v4**: Formato de payload estándar
-  **Autenticación MQTT**: Soporte para usuario/contraseña
- 📍 **Geolocalización**: Cada sensor incluye coordenadas GPS simuladas

---

## 🛠️ Requisitos

- **Node.js** >= 16.0.0
- **Broker MQTT** (Mosquitto recomendado) corriendo en `localhost:1883`
- Conexión a internet (para descarga de dependencias npm)

---

## 📥 Instalación

### 1. Clonar o descargar el proyecto

```bash
# Desde la raíz del repositorio (ruta relativa, válida en cualquier equipo)
cd simulator
```

### 2. Instalar dependencias

```bash
npm install
```

Esto instalará:
- `mqtt` (v5.15.2) - Cliente MQTT para Node.js
- Todas las dependencias auxiliares (buffers, streams, etc.)

### 3. Verificar instalación

```bash
npm list
```

---

## ⚙️ Configuración

### Variables de Entorno (Recomendado)

Crea un archivo `.env` en la raíz del proyecto o configura las variables en tu sistema:

```env
# Broker MQTT
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=iot
MQTT_PASSWORD=changeme

# Configuración por defecto
SENSOR_COUNT=5
INTERVAL_MS=300000
INJECT_ANOMALIES=true
```

**Nota:** Las variables de entorno tienen prioridad sobre los argumentos CLI.

### Configuración del Broker MQTT

Asegúrate de tener Mosquitto corriendo:

```bash
# Verificar si está escuchando en el puerto 1883
netstat -ano | findstr :1883

# Iniciar Mosquitto manualmente (si está instalado)
mosquitto -v
```

---

## 🚀 Uso

### Comandos Básicos

#### 1. Modo Producción (5 minutos reales)

```bash
npm run simulate:5min
# o
node mock-lora-devices.js
```

**Resultado:** 5 sensores enviando datos cada 5 minutos.

#### 2. Modo Anomalías (Testing de alertas)

```bash
npm run simulate:anomalies
# o
node mock-lora-devices.js --anomalies
```

**Resultado:** Inyección automática de valores anómalos (humedad >85%, batería baja, etc.).

#### 3. Modo Rápido (Desarrollo/Debugging)

```bash
npm run simulate:fast
# o
node mock-lora-devices.js --interval 5000 --anomalies
```

**Resultado:** Datos cada 5 segundos. Ideal para ver actualizaciones en tiempo real en tu dashboard.

#### 4. Prueba de Carga (100 sensores)

```bash
npm run load-test
# o
node mock-lora-devices.js --count 100 --interval 2000
```

**Resultado:** 100 dispositivos simulados enviando datos cada 2 segundos.

---

## 🔍 Funcionamiento Detallado

### Paso 1: Inicialización

Al ejecutar el script, ocurre lo siguiente:

```javascript
// 1. Lectura de configuración
MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883'
MQTT_USER = process.env.MQTT_USERNAME || 'iot'
MQTT_PASS = process.env.MQTT_PASSWORD || 'changeme'
SENSOR_COUNT = 5 (por defecto)
INTERVAL_MS = 300000 (5 minutos)
```

### Paso 2: Generación de Sensores

Se crean `SENSOR_COUNT` dispositivos virtuales con:

- **devEui**: Identificador único de 64 bits (ej: `0011223344556601`)
- **Ubicación**: Coordenadas GPS basadas en ubicaciones reales de Galicia
- **Valores base**: 
  - Humedad: 45-80%
  - Temperatura: 18-26°C
  - Batería: 3.85V (degradación simulada)

**Ejemplo de sensor generado:**

```javascript
{
  devEui: "0011223344556601",
  name: "Sensor Humedad - Lago de Castiñeiras (Pontevedra)",
  baseHumidity: 51,
  baseTemp: 19.5,
  baseBattery: 3.80,
  lat: 42.3486,
  lng: -8.6747,
  fcnt: 100  // Contador de mensajes
}
```

### Paso 3: Conexión MQTT

El simulador establece conexión con el broker:

```javascript
client = mqtt.connect(MQTT_URL, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `lora_sim_${random_string}`
})
```

**Eventos manejados:**
- ✅ `connect`: Conexión exitosa
- ❌ `error`: Fallo de conexión (credenciales incorrectas, broker apagado, etc.)

### Paso 4: Generación de Datos (Ciclo de Transmisión)

Cada `INTERVAL_MS`, se ejecuta `transmitUplinks(tick)`:

#### 4.1 Fluctuaciones Naturales

Para cada sensor, se calculan valores realistas:

```javascript
// Humedad con variación sinusoidal + ruido aleatorio
humidity = baseHumidity + Math.sin(tick * 0.2 + idx) * 5 + (Math.random() * 2 - 1)

// Temperatura con patrón cíclico
temperature = baseTemp + Math.cos(tick * 0.2 + idx) * 3 + (Math.random() * 0.8 - 0.4)

// Degradación de batería (simula desgaste real)
battery = Math.max(2.9, baseBattery - (tick * 0.0005))

// Señal de radio (RSSI/SNR realistas para LoRaWAN)
rssi = -95 - Math.floor(Math.random() * 15)  // -95 a -110 dBm
snr = 7.5 + (Math.random() * 3 - 1.5)        // 6.0 a 9.0 dB
```

#### 4.2 Inyección de Anomalías (si `--anomalies` está activo)

**Sensor 0 (índice 0):**
- Cada 6 ciclos, durante 3 ciclos: Humedad sube a **86-89%** (anomalía de humedad alta)
- Luego vuelve a **65.2%** (normal)

**Sensor 1 (índice 1):**
- Cada 8 ciclos, durante 3 ciclos: Humedad baja a **22-24%** (anomalía de sequedad extrema)

**Propósito:** Probar la **histéresis** del sistema de alertas (disparo y resolución automática).

#### 4.3 Codificación del Payload

Los datos se empaquetan en **dos formatos**:

**A. Formato Binario (base64) - Para decodificación en ChirpStack:**

```javascript
data: Buffer.from([
  Math.floor(humidity * 10) >> 8,        // Humedad (bytes altos)
  Math.floor(humidity * 10) & 0xff,      // Humedad (bytes bajos)
  Math.floor(temperature * 10) >> 8,     // Temperatura (bytes altos)
  Math.floor(temperature * 10) & 0xff,   // Temperatura (bytes bajos)
  Math.floor(battery * 1000) >> 8,       // Batería (bytes altos)
  Math.floor(battery * 1000) & 0xff,     // Batería (bytes bajos)
]).toString('base64')
```

**Ejemplo:** `humidity=68.4` → `684` → `0x02AC` → Bytes: `[0x02, 0xAC]`

**B. Formato JSON (object) - Para lectura directa:**

```javascript
object: {
  humidity: 68.42,
  temperature: 23.15,
  battery: 3.84,
  pressure: 1013.2,      // Valor fijo (simulado)
  latitude: 42.3486,
  longitude: -8.6747
}
```

### Paso 5: Publicación MQTT

El mensaje se publica en el topic estándar de ChirpStack v4:

```javascript
topic = `application/1/device/${devEui}/event/up`
```

**Ejemplo de topic:**
```
application/1/device/0011223344556601/event/up
```

**Estructura completa del mensaje:**

```json
{
  "applicationId": "1",
  "deviceInfo": {
    "tenantId": "1",
    "applicationId": "1",
    "deviceProfileId": "profile-soil-moisture",
    "deviceName": "Sensor Humedad - Lago de Castiñeiras",
    "devEui": "0011223344556601"
  },
  "time": "2026-09-08T10:30:45.123Z",
  "fCnt": 101,
  "fPort": 2,
  "data": "AgC4A...",  // Base64 del payload binario
  "object": {
    "humidity": 68.42,
    "temperature": 23.15,
    "battery": 3.84,
    "pressure": 1013.2,
    "latitude": 42.3486,
    "longitude": -8.6747
  },
  "rxInfo": [
    {
      "gatewayId": "AABBCCDDEEFF0011",
      "rssi": -98,
      "snr": 8.2
    }
  ]
}
```

### Paso 6: Ciclo Continuo

```javascript
// Primer envío inmediato
transmitUplinks(1)

// Envíos periódicos
setInterval(() => {
  tick++
  transmitUplinks(tick)
}, INTERVAL_MS)
```

**Salida en consola:**
```
[12:30:45]  Uplinks LoRaWAN enviados para 5 sensores (Ciclo #1)
 Próximo envío programado en 5 minutos...
```

---

## 📦 Estructura del Payload

### Campos Principales

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `applicationId` | String | ID de aplicación en ChirpStack | `"1"` |
| `deviceInfo.devEui` | String | Identificador único del dispositivo | `"0011223344556601"` |
| `deviceInfo.deviceName` | String | Nombre descriptivo del sensor | `"Sensor Humedad - Lago..."` |
| `time` | ISO 8601 | Timestamp del mensaje | `"2026-09-08T10:30:45.123Z"` |
| `fCnt` | Integer | Contador de frames (incremental) | `101` |
| `fPort` | Integer | Puerto LoRaWAN (1-223) | `2` |
| `data` | Base64 | Payload binario codificado | `"AgC4A..."` |
| `object` | JSON | Payload decodificado (legible) | `{humidity: 68.42, ...}` |
| `rxInfo[].rssi` | Integer | Fuerza de señal recibida (dBm) | `-98` |
| `rxInfo[].snr` | Float | Relación señal-ruido (dB) | `8.2` |

### Decodificación del Payload Binario

El campo `data` contiene 6 bytes:

| Bytes | Campo | Fórmula | Rango |
|-------|-------|---------|-------|
| 0-1 | Humedad | `(byte0 << 8 | byte1) / 10` | 0-6553.5% |
| 2-3 | Temperatura | `(byte2 << 8 | byte3) / 10` | -3276.8 a 3276.7°C |
| 4-5 | Batería | `(byte4 << 8 | byte5) / 1000` | 0-65.535V |

**Ejemplo práctico:**

Bytes: `[0x02, 0xAC, 0x00, 0xE7, 0x0F, 0x08]`

- Humedad: `(0x02AC) / 10 = 684 / 10 = 68.4%`
- Temperatura: `(0x00E7) / 10 = 231 / 10 = 23.1°C`
- Batería: `(0x0F08) / 1000 = 3848 / 1000 = 3.848V`

---

## 📚 Referencia de Comandos

### Scripts NPM

| Comando | Descripción | Intervalo | Sensores | Anomalías |
|---------|-------------|-----------|----------|-----------|
| `npm start` | Alias de simulate:5min | 5 min | 5 | ❌ |
| `npm run simulate:5min` | Modo producción | 5 min | 5 | ❌ |
| `npm run simulate:anomalies` | Testing de alertas | 5 min | 5 | ✅ |
| `npm run simulate:fast` | Desarrollo/Debug | 5 seg | 5 | ✅ |
| `npm run load-test` | Prueba de carga | 2 seg | 100 | ❌ |

### Argumentos CLI

| Argumento | Alias | Tipo | Por defecto | Descripción |
|-----------|-------|------|-------------|-------------|
| `--url` | | String | `mqtt://localhost:1883` | URL del broker MQTT |
| `--user` | | String | `iot` | Usuario MQTT |
| `--pass` | | String | `changeme` | Contraseña MQTT |
| `--count` | | Integer | `5` | Número de sensores a simular |
| `--interval` | | Integer | `300000` | Intervalo en ms entre envíos |
| `--anomalies` | | Flag | `false` | Activar inyección de anomalías |

**Ejemplos avanzados:**

```bash
# Conectar a broker remoto
node mock-lora-devices.js --url mqtt://192.168.1.100:1883 --user admin --pass secret123

# Simular 20 sensores cada 10 segundos
node mock-lora-devices.js --count 20 --interval 10000

# Modo rápido sin anomalías
node mock-lora-devices.js --interval 1000

# Combinación de parámetros
node mock-lora-devices.js --count 50 --interval 5000 --anomalies --url mqtt://broker.hivemq.com:1883
```

---

##  Solución de Problemas

### ❌ Error: "connack timeout"

**Causa:** El broker MQTT no está corriendo o no es accesible.

**Solución:**
```bash
# Verificar si Mosquitto está escuchando
netstat -ano | findstr :1883

# Si no hay resultado, iniciar Mosquitto
mosquitto -v

# O verificar que Docker esté corriendo (si usas docker-compose)
docker-compose ps
```

### ❌ Error: "Connection refused"

**Causa:** Credenciales incorrectas o broker requiere autenticación.

**Solución:**
```bash
# Verificar usuario/contraseña en .env
MQTT_USERNAME=iot
MQTT_PASSWORD=changeme

# O pasar por CLI
node mock-lora-devices.js --user iot --pass changeme
```

###  Los sensores no envían datos

**Causa:** Intervalo demasiado largo o proceso bloqueado.

**Solución:**
```bash
# Usar modo rápido para verificar
npm run simulate:fast

# Verificar consola: debe mostrar "[HH:MM:SS] 📡 Uplinks LoRaWAN enviados..."
```

###  Verificar que los mensajes llegan al broker

**Opción 1: Suscribirse desde otra terminal**
```bash
# Instalar cliente MQTT CLI
npm install -g mqtt

# Suscribirse a todos los topics de la aplicación
mqtt sub -t 'application/1/device/+/event/up' -h localhost
```

**Opción 2: Usar MQTT Explorer (GUI)**
- Descargar: https://mqtt-explorer.com/
- Conectar a: `mqtt://localhost:1883`
- Ver topics: `application/1/device/#`

---

## 🌐 Ubicaciones de Sensores Simulados

El simulador incluye 5 ubicaciones reales en Galicia:

1. **Lago de Castiñeiras (Pontevedra)** - 42.3486, -8.6747
2. **Estación Ambiental - Lago de Castiñeiras** - 42.3495, -8.6738
3. **Polígono da Sionlla (Santiago)** - 42.9135, -8.5132
4. **Polígono da Sionlla (Santiago)** - 42.9142, -8.5120
5. **Monte Aloia (Pontevedra)** - 42.0682, -8.6750

---

## 📝 Licencia

Desarrollado por **Neutron Insights** para la plataforma **CORNEA IoT**.

---

##  Contribuciones

Para reportar bugs o solicitar características:
1. Abrir un issue en el repositorio
2. Incluir logs de error completos
3. Especificar versión de Node.js y sistema operativo

---

**¡Gracias por usar CORNEA IoT Simulator! 🚀**