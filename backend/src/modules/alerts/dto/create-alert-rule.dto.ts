import { IsNotEmpty, IsString, IsNumber, IsIn, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlertRuleDto {
  @ApiPropertyOptional({ description: 'ID de dispositivo específico o null para regla global del tenant' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiProperty({ example: 'Alerta Humedad Excesiva (>80%)' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'humidity', enum: ['humidity', 'temperature', 'battery', 'rssi', 'snr', 'offline'] })
  @IsIn(['humidity', 'temperature', 'battery', 'rssi', 'snr', 'offline'])
  metric: string;

  @ApiProperty({ example: '>=', enum: ['>', '>=', '<', '<=', '==', '!='] })
  @IsIn(['>', '>=', '<', '<=', '==', '!='])
  condition: string;

  @ApiProperty({ example: 80.0 })
  @IsNumber()
  threshold: number;

  @ApiPropertyOptional({ example: 300, description: 'Duración requerida en segundos para disparar la alerta' })
  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @ApiPropertyOptional({ example: 3.0, description: 'Banda de histéresis para evitar flapping en la resolución' })
  @IsOptional()
  @IsNumber()
  hysteresis?: number;

  @ApiPropertyOptional({ example: 'warning', enum: ['low', 'warning', 'critical'] })
  @IsOptional()
  @IsIn(['low', 'warning', 'critical'])
  severity?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: ['webhook', 'email'] })
  @IsOptional()
  @IsArray()
  channels?: string[];
}

export class UpdateAlertRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hysteresis?: number;

  @ApiPropertyOptional({ enum: ['low', 'warning', 'critical'] })
  @IsOptional()
  @IsIn(['low', 'warning', 'critical'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  channels?: string[];
}
