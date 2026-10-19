import { IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, IsIn, IsInt, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeviceDto {
  @ApiPropertyOptional({
    example: '0011223344556601',
    description: 'DevEUI LoRaWAN (16 hex). Si se deja vacío, el backend genera uno único',
  })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{16}$/, { message: 'El DevEUI debe tener 16 caracteres hexadecimales' })
  devEui?: string;

  @ApiProperty({ example: 'Sensor Humedad Suelo - Sector A1' })
  @IsNotEmpty({ message: 'El nombre del sensor es requerido' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Sonda capacitiva a 30cm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Finca Norte - Olivos' })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiPropertyOptional({ example: 40.416775 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -3.703790 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Lago de Castiñeiras, Pontevedra' })
  @IsOptional()
  @IsString()
  placeName?: string;

  @ApiPropertyOptional({ example: 1013.2, description: 'Presión de referencia en el punto (hPa)' })
  @IsOptional()
  @IsNumber()
  pressure?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 20.0 })
  @IsOptional()
  @IsNumber()
  batteryThreshold?: number;

  @ApiPropertyOptional({ default: 30.0 })
  @IsOptional()
  @IsNumber()
  humidityMinThreshold?: number;

  @ApiPropertyOptional({ default: 80.0 })
  @IsOptional()
  @IsNumber()
  humidityMaxThreshold?: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'Crear además el perfil del Simulador de datos de prueba para este sensor (mismo DevEUI)',
  })
  @IsOptional()
  @IsBoolean()
  createSimProfile?: boolean;

  @ApiPropertyOptional({ default: 30.0, description: 'Perfil de simulación: recuento base de neutrones' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(200)
  simBaseNeutrons?: number;

  @ApiPropertyOptional({ default: 'none', enum: ['none', 'high', 'low'] })
  @IsOptional()
  @IsIn(['none', 'high', 'low'])
  simAnomalyMode?: 'none' | 'high' | 'low';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  simAnomalyEvery?: number;
}

export class UpdateDeviceVisibilityDto {
  @ApiPropertyOptional({ default: true, description: 'Mostrar la sonda en Dashboard y mapas (solo admin)' })
  @IsBoolean()
  visible: boolean;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Lago de Castiñeiras, Pontevedra' })
  @IsOptional()
  @IsString()
  placeName?: string;

  @ApiPropertyOptional({ example: 1013.2 })
  @IsOptional()
  @IsNumber()
  pressure?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  batteryThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  humidityMinThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  humidityMaxThreshold?: number;
}
