import { Module } from '@nestjs/common';
import { SimService } from './sim.service';
import { SimController } from './sim.controller';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
  imports: [IngestionModule],
  controllers: [SimController],
  providers: [SimService],
  exports: [SimService],
})
export class SimModule {}
