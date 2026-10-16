import { Module } from '@nestjs/common';
import { SimService } from './sim.service';
import { SimController } from './sim.controller';

@Module({
  controllers: [SimController],
  providers: [SimService],
  exports: [SimService],
})
export class SimModule {}
