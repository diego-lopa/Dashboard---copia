import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/create-device.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los dispositivos del tenant con su estado en tiempo real' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.findAll(user.tenantId);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Obtener los últimos valores de telemetría de todos los dispositivos' })
  async getLatest(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.getLatestMetrics(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un dispositivo y su última medición' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Registrar un nuevo dispositivo LoRaWAN' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Actualizar configuración o umbrales del dispositivo' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, user.tenantId, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar un dispositivo (Solo Admin)' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.delete(id, user.tenantId);
  }
}
