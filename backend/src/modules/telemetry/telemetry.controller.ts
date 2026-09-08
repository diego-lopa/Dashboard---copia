import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Header,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types';

@ApiTags('Telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/devices')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get(':id/measurements')
  @ApiOperation({ summary: 'Consultar histórico de mediciones y agregados time-series' })
  async getMeasurements(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.telemetryService.getDeviceMeasurements(id, user.tenantId, query);
  }

  @Get(':id/export/csv')
  @ApiOperation({ summary: 'Exportar mediciones del dispositivo a formato CSV' })
  async exportCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TelemetryQueryDto,
    @Res() res: Response,
  ) {
    const csvData = await this.telemetryService.exportCsv(id, user.tenantId, query);
    const filename = `telemetry_${id}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  }
}
