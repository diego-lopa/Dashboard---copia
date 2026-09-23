import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SimService } from './sim.service';
import { CreateSimSensorDto, UpdateSimSensorDto, UpdateSimStateDto } from './dto/sim.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';

/**
 * Simulador de datos de prueba gestionable desde el panel admin.
 * Todo es SOLO admin: crear/editar/eliminar sensores virtuales y
 * activar/desactivar la emisión con su frecuencia.
 */
@ApiTags('SimManager')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/v1/sim')
export class SimController {
  constructor(private readonly simService: SimService) {}

  @Get('state')
  @ApiOperation({ summary: 'Estado del simulador (activado + frecuencia ms)' })
  async getState(@CurrentUser() user: AuthenticatedUser) {
    return this.simService.getState(user.tenantId);
  }

  @Put('state')
  @ApiOperation({ summary: 'Activar/desactivar y fijar frecuencia de mensajes' })
  async updateState(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSimStateDto) {
    return this.simService.updateState(user.tenantId, dto);
  }

  @Get('sensors')
  @ApiOperation({ summary: 'Listar sensores virtuales' })
  async listSensors(@CurrentUser() user: AuthenticatedUser) {
    return this.simService.listSensors(user.tenantId);
  }

  @Post('sensors')
  @ApiOperation({ summary: 'Añadir sensor virtual (DevEUI vacío = autogenerado)' })
  async createSensor(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSimSensorDto) {
    return this.simService.createSensor(user.tenantId, dto);
  }

  @Patch('sensors/:id')
  @ApiOperation({ summary: 'Editar sensor virtual (datos, umbrales, anomalías)' })
  async updateSensor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSimSensorDto,
  ) {
    return this.simService.updateSensor(id, user.tenantId, dto);
  }

  @Delete('sensors/:id')
  @ApiOperation({ summary: 'Eliminar sensor virtual' })
  async deleteSensor(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.simService.deleteSensor(id, user.tenantId);
  }
}
