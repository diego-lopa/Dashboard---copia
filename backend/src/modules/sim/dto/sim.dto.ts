import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSimSensorDto {
  @ApiPropertyOptional({ example: 'CORNEA Demo 01' })
  @IsNotEmpty({ message: 'El nombre del sensor es requerido' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: '00112233445566A1',
    description: 'DevEUI 16 hex. Vacío = se genera uno único',
  })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{16}$/, { message: 'El DevEUI debe tener 16 caracteres hexadecimales' })
  devEui?: string;

  @ApiPropertyOptional({ default: 55.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baseHumidity?: number;

  @ApiPropertyOptional({ default: 19.0 })
  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(90)
  baseTemp?: number;

  @ApiPropertyOptional({ default: 3.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  baseBattery?: number;

  @ApiPropertyOptional({ default: 1012.0 })
  @IsOptional()
  @IsNumber()
  @Min(700)
  @Max(1200)
  basePressure?: number;

  @ApiPropertyOptional({ example: 42.3486 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -8.6747 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 'none', enum: ['none', 'high', 'low'] })
  @IsOptional()
  @IsIn(['none', 'high', 'low'])
  anomalyMode?: 'none' | 'high' | 'low';

  @ApiPropertyOptional({ default: 20, description: '1 mensaje anómalo cada N' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  anomalyEvery?: number;

  @ApiPropertyOptional({ default: 15.0 })
  @IsOptional()
  @IsNumber()
  humidityMinThreshold?: number;

  @ApiPropertyOptional({ default: 85.0 })
  @IsOptional()
  @IsNumber()
  humidityMaxThreshold?: number;

  @ApiPropertyOptional({ default: 20.0 })
  @IsOptional()
  @IsNumber()
  batteryThreshold?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSimSensorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  baseHumidity?: number;

  @IsOptional()
  @IsNumber()
  @Min(-50)
  @Max(90)
  baseTemp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  baseBattery?: number;

  @IsOptional()
  @IsNumber()
  @Min(700)
  @Max(1200)
  basePressure?: number;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsIn(['none', 'high', 'low'])
  anomalyMode?: 'none' | 'high' | 'low';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  anomalyEvery?: number;

  @IsOptional()
  @IsNumber()
  humidityMinThreshold?: number;

  @IsOptional()
  @IsNumber()
  humidityMaxThreshold?: number;

  @IsOptional()
  @IsNumber()
  batteryThreshold?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSimStateDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 30000, description: 'Frecuencia de mensajes en ms (mín. 2000)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(3600000)
  intervalMs?: number;
}
