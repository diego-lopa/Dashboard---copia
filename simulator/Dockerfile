# ==============================================================================
# SIMULADOR DE SENSORES LORAWAN — imagen ligera para tráfico demo automático
# Arranca solo con `docker compose up` y envía la primera ráfaga al conectar.
# ==============================================================================
FROM node:20-alpine

WORKDIR /sim

COPY package*.json ./
RUN npm install --omit=dev

COPY mock-lora-devices.js ./

# Por defecto: modo neutrónico CRNS cada 30 min (como las sondas físicas).
# Se ajusta con variables de entorno en docker-compose.yml (servicio simulator).
CMD ["node", "mock-lora-devices.js"]
