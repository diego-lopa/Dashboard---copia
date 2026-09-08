import { IsOptional, IsString, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TelemetryQueryDto {
  @ApiPropertyOptional({ example: '2026-02-01T00:00:00Z', description: 'Fecha/hora inicio ISO8601' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-02-16T23:59:59Z', description: 'Fecha/hora fin ISO8601' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: '15m', description: 'Intervalo de agregación: raw, 1m, 5m, 15m, 1h, 1d' })
  @IsOptional()
  @IsString()
  interval?: string;

  @ApiPropertyOptional({ example: 'humidity,temperature,battery', description: 'Métricas requeridas separadas por coma' })
  @IsOptional()
  @IsString()
  metrics?: string;

  @ApiPropertyOptional({ example: 'avg,min,max', description: 'Tipo de agregación' })
  @IsOptional()
  @IsString()
  aggregate?: string;
}
