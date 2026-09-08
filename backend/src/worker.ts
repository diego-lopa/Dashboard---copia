import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AlertsEngineService } from './modules/alerts/alerts-engine.service';

async function bootstrapWorker() {
  const logger = new Logger('TelemetryWorker');
  logger.log('⚙️ Inicializando Worker de Telemetría e Ingesta LoRaWAN...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const alertsEngine = app.get(AlertsEngineService);

  // Monitor periódico de sensores desconectados cada 60 segundos
  setInterval(async () => {
    try {
      await alertsEngine.checkOfflineDevices();
    } catch (err) {
      logger.error(`Error en watchdog periódico: ${err.message}`);
    }
  }, 60000);

  logger.log('✅ Worker de Telemetría, MQTT Listener y Watchdog activo');
}

bootstrapWorker();
