import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsEngineService } from './alerts-engine.service';
import { AlertsController } from './alerts.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEngineService],
  exports: [AlertsService, AlertsEngineService],
})
export class AlertsModule {}
