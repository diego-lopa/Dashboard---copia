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
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/create-alert-rule.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('alert-rules')
  @ApiOperation({ summary: 'Listar reglas de alerta del tenant' })
  async findAllRules(@CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.findAllRules(user.tenantId);
  }

  @Get('alert-rules/:id')
  @ApiOperation({ summary: 'Obtener detalle de una regla de alerta' })
  async findOneRule(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.findOneRule(id, user.tenantId);
  }

  @Post('alert-rules')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Crear nueva regla de alerta' })
  async createRule(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertRuleDto) {
    return this.alertsService.createRule(user.tenantId, dto);
  }

  @Patch('alert-rules/:id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Actualizar regla de alerta' })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(id, user.tenantId, dto);
  }

  @Delete('alert-rules/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar regla de alerta (Solo Admin)' })
  async deleteRule(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.deleteRule(id, user.tenantId);
  }

  @Get('alert-events')
  @ApiOperation({ summary: 'Listar histórico de incidentes/eventos de alerta' })
  async findAllEvents(@CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.findAllEvents(user.tenantId);
  }

  @Post('alert-events/:id/acknowledge')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'Reconocer evento de alerta' })
  async acknowledgeEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.alertsService.acknowledgeEvent(id, user.tenantId, user.userId);
  }
}
