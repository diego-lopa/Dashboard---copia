import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { RealtimeEventPayload } from '../../shared/types';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private eventSubject = new Subject<MessageEvent>();

  emitEvent(payload: RealtimeEventPayload) {
    const sseFormattedData = {
      data: payload,
    } as MessageEvent;

    this.eventSubject.next(sseFormattedData);
  }

  getEventStream(): Observable<MessageEvent> {
    return this.eventSubject.asObservable();
  }

  broadcastMeasurement(deviceId: string, devEui: string, metrics: any) {
    this.emitEvent({
      type: 'measurement',
      deviceId,
      devEui,
      ts: new Date().toISOString(),
      data: metrics,
    });
  }

  broadcastAlert(deviceId: string, alertData: any) {
    this.emitEvent({
      type: 'alert',
      deviceId,
      ts: new Date().toISOString(),
      data: alertData,
    });
  }

  broadcastDeviceStatus(deviceId: string, status: string, lastSeenAt: string) {
    this.emitEvent({
      type: 'device_status',
      deviceId,
      ts: new Date().toISOString(),
      data: { status, lastSeenAt },
    });
  }
}
