import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { MqttSubscriberService } from './mqtt-subscriber.service';
import { HttpIngestController } from './http-ingest.controller';
import { PayloadCodecService } from './codecs/payload-codec.service';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [HttpIngestController],
  providers: [IngestionService, MqttSubscriberService, PayloadCodecService],
  exports: [IngestionService, MqttSubscriberService, PayloadCodecService],
})
export class IngestionModule {}
