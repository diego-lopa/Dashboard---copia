import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { IngestionService } from './ingestion.service';

@Injectable()
export class MqttSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttSubscriberService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  onModuleInit() {
    if (this.configService.get<boolean>('mqtt.subscribe') === false) {
      this.logger.log('Suscripción MQTT desactivada en este proceso (MQTT_SUBSCRIBE=false). Solo el worker ingiere.');
      return;
    }
    this.connectMqtt();
  }

  private connectMqtt() {
    const url = this.configService.get<string>('mqtt.url');
    const username = this.configService.get<string>('mqtt.username');
    const password = this.configService.get<string>('mqtt.password');
    const topic = this.configService.get<string>('mqtt.topicSubscription');

    this.logger.log(`Conectando al Broker MQTT en ${url}...`);

    this.client = mqtt.connect(url, {
      username,
      password,
      clientId: `cornea_worker_${Math.random().toString(16).substring(2, 8)}`,
      clean: false,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Conexión establecida exitosamente con Mosquitto Broker');
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Error suscribiendo al tópico ${topic}: ${err.message}`);
        } else {
          this.logger.log(`📡 Suscrito exitosamente al tópico LoRaWAN: ${topic}`);
        }
      });
    });

    this.client.on('message', async (recvTopic, payloadBuffer) => {
      try {
        const payloadStr = payloadBuffer.toString();
        const jsonMsg = JSON.parse(payloadStr);
        this.logger.debug(`Mensaje recibido en ${recvTopic}: ${payloadStr.substring(0, 100)}...`);
        await this.ingestionService.processRawMessage(jsonMsg);
      } catch (err) {
        this.logger.error(`Error procesando mensaje MQTT en ${recvTopic}: ${err.message}`);
      }
    });

    this.client.on('error', (err) => {
      this.logger.error(`Error en cliente MQTT: ${err.message}`);
    });

    this.client.on('offline', () => {
      this.logger.warn('Broker MQTT offline. Reintentando conexión...');
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
      this.logger.log('Cliente MQTT desconectado');
    }
  }
}
