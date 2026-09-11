import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('mqtt-status')
  @Roles('admin')
  @ApiOperation({ summary: 'Comprobar alcance del broker MQTT desde el backend (TCP)' })
  async mqttStatus() {
    return this.systemService.checkMqtt();
  }
}
