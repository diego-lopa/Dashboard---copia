import { Controller, Post, Body, Headers, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';

@ApiTags('Ingestion')
@Controller('api/v1/ingest')
export class HttpIngestController {
  constructor(
    private readonly configService: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('gateway')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Endpoint de ingesta HTTP para gateways LoRaWAN legacy o adaptadores HTTPS' })
  @ApiHeader({ name: 'X-API-Key', required: true, description: 'Clave de autenticación del gateway' })
  @ApiResponse({ status: 202, description: 'Medición aceptada y encolada para procesamiento' })
  @ApiResponse({ status: 401, description: 'Clave de API inválida' })
  async ingestGateway(
    @Body() payload: any,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const configuredApiKey = this.configService.get<string>('security.apiKeyIngest');
    const providedKey =
      apiKeyHeader ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!providedKey || providedKey !== configuredApiKey) {
      throw new UnauthorizedException('API Key de Ingesta no válida');
    }

    const success = await this.ingestionService.processRawMessage(payload);
    return {
      status: success ? 'accepted' : 'rejected',
      timestamp: new Date().toISOString(),
    };
  }
}
