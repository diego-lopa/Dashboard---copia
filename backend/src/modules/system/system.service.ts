import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

export interface GeocodeResult {
  found: boolean;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  pressure: number | null;
}

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

  /**
   * Geocodificación por nombre (Nominatim) + presión de referencia del punto
   * (Open-Meteo). Se hace desde el backend para que el navegador no dependa
   * de CORS ni de acceso saliente a esos servicios, y para poder cachear.
   * `place` = texto ("Monte Aloia, Tui"), `lat`/`lon` = reverse (opcional).
   */
  async geocode(place?: string, lat?: number, lon?: number): Promise<GeocodeResult> {
    const userAgent = 'CORNEA/1.0 (+https://github.com/neutroninsights/cornea)';
    const timeout = 8000;

    let coords: { lat: number; lon: number; display: string } | null = null;

    if (place && place.trim() !== '') {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        place.trim(),
      )}&accept-language=es`;
      const res = await this.fetchJson(url, { 'User-Agent': userAgent }, timeout);
      const first = Array.isArray(res) ? res[0] : null;
      if (first?.lat && first?.lon) {
        coords = {
          lat: parseFloat(first.lat),
          lon: parseFloat(first.lon),
          display: String(first.display_name ?? place).trim(),
        };
      }
    } else if (typeof lat === 'number' && typeof lon === 'number') {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=es`;
      const res = await this.fetchJson(url, { 'User-Agent': userAgent }, timeout);
      if (res?.display_name) {
        coords = { lat, lon, display: String(res.display_name).trim() };
      }
    }

    if (!coords) {
      return { found: false, place: place ?? null, latitude: null, longitude: null, pressure: null };
    }

    // Presión de referencia del sitio (hPa) para la corrección barométrica.
    let pressure: number | null = null;
    try {
      const meteo = await this.fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=pressure_msl&timezone=auto`,
        {},
        timeout,
      );
      const p = meteo?.current?.pressure_msl;
      if (typeof p === 'number') pressure = +p.toFixed(1);
    } catch {
      pressure = null; // sin presión: la sonda la aportará en cada uplink
    }

    return {
      found: true,
      place: coords.display,
      latitude: +coords.lat.toFixed(6),
      longitude: +coords.lon.toFixed(6),
      pressure,
    };
  }

  private async fetchJson(url: string, headers: Record<string, string>, timeout: number): Promise<any> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
