import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 8000;

  // 1. Configuración de CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-API-Key',
  });

  // 2. Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 3. Documentación OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CORNEA IoT LoRaWAN Platform API')
    .setDescription(
      'API REST para la monitorización en tiempo real, gestión de dispositivos LoRaWAN, telemetría time-series y motor de alertas con histéresis.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticación y tokens JWT')
    .addTag('Devices', 'Gestión de sensores y últimos valores')
    .addTag('Telemetry', 'Histórico Time-Series, Continuous Aggregates y exportación CSV')
    .addTag('Alerts', 'Reglas de alerta, incidentes y confirmación (Ack)')
    .addTag('Ingestion', 'Ingesta HTTP directa para gateways y adaptadores')
    .addTag('Realtime', 'Streaming en tiempo real SSE')
    .addTag('Users', 'Gestión de usuarios y permisos')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // 4. Healthcheck básico
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'cornea-backend-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  await app.listen(port);
  logger.log(`🚀 Servidor API REST activo en http://localhost:${port}`);
  logger.log(`📚 Documentación Swagger disponible en http://localhost:${port}/api/docs`);
}

bootstrap();
