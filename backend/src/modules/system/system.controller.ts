import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  @Get('geocode')
  @Roles('admin', 'operator')
  @ApiOperation({
    summary: 'Geocodificar por nombre (o por coordenadas) y devolver la presión del punto',
  })
  async geocode(
    @Query('place') place?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ) {
    const latNum = lat !== undefined && lat !== '' ? Number(lat) : undefined;
    const lonNum = lon !== undefined && lon !== '' ? Number(lon) : undefined;
    return this.systemService.geocode(
      place,
      Number.isFinite(latNum as number) ? latNum : undefined,
      Number.isFinite(lonNum as number) ? lonNum : undefined,
    );
  }
}
