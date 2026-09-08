import { Controller, Sse, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { RealtimeService } from './realtime.service';

@ApiTags('Realtime')
@Controller('api/v1/stream')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('events')
  @ApiOperation({ summary: 'Flujo de eventos en tiempo real vía Server-Sent Events (SSE)' })
  streamEvents(): Observable<{ data: any }> {
    return this.realtimeService.getEventStream().pipe(
      map((event) => ({
        data: event.data,
      })),
    );
  }
}
