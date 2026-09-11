import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

@Injectable()
export class SystemService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Comprueba el broker MQTT con una conexión TCP desde el backend
   * (misma red Docker). Más fiable que sondas WebSocket desde el navegador,
   * que pueden bloquear cortafuegos o el propio navegador.
   */
  async checkMqtt(): Promise<{ online: boolean; latencyMs: number | null; host: string }> {
    const url = this.configService.get<string>('mqtt.url') || 'mqtt://mosquitto:1883';
    const m = url.match(/^mqtt:\/\/([^:/]+)(?::(\d+))?/);
    const host = m?.[1] || 'mosquitto';
    const port = m?.[2] ? parseInt(m[2], 10) : 1883;

    const started = Date.now();
    const online = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      const done = (ok: boolean) => {
        try {
          socket.destroy();
        } catch {
          /* noop */
        }
        resolve(ok);
      };
      socket.setTimeout(3000);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
      socket.connect(port, host);
    });

    return { online, latencyMs: online ? Date.now() - started : null, host: `${host}:${port}` };
  }
}
