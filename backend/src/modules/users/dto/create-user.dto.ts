import { IsEmail, IsNotEmpty, MinLength, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../shared/types';

export class CreateUserDto {
  @ApiProperty({ example: 'tecnico@empresa.com' })
  @IsEmail({}, { message: 'Formato de email inválido' })
  email: string;

  @ApiProperty({ example: 'passwordSeguro123' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'operator', enum: ['admin', 'operator', 'viewer'] })
  @IsIn(['admin', 'operator', 'viewer'], { message: 'El rol debe ser admin, operator o viewer' })
  role: UserRole;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: ['admin', 'operator', 'viewer'] })
  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
