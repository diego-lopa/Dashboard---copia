import { Injectable, Logger } from '@nestjs/common';
import { NormalizedUplink } from '../../../shared/types';

@Injectable()
export class PayloadCodecService {
  private readonly logger = new Logger(PayloadCodecService.name);

  /**
   * Decodifica y normaliza un mensaje proveniente de ChirpStack o Ingesta HTTP directa
   */
  decode(rawMessage: any): NormalizedUplink | null {
    try {
      // 1. Si el mensaje ya viene en formato de evento ChirpStack v4 JSON
      if (rawMessage.deviceInfo && rawMessage.deviceInfo.devEui) {
        return this.decodeChirpStackV4(rawMessage);
      }

      // 2. Si viene de formato ChirpStack v3 / genérico
      if (rawMessage.devEUI || rawMessage.devEui) {
        return this.decodeGenericJson(rawMessage);
      }

      // 3. Fallback: Si no tiene devEUI detectable
      this.logger.warn('Mensaje recibido sin DevEUI identificado');
      return null;
    } catch (err) {
      this.logger.error(`Error decodificando payload: ${err.message}`);
      return null;
    }
  }

  private decodeChirpStackV4(msg: any): NormalizedUplink {
    const devEui = msg.deviceInfo.devEui.toUpperCase();
    const ts = msg.time || new Date().toISOString();
    const rxInfo = msg.rxInfo && msg.rxInfo[0] ? msg.rxInfo[0] : {};

    let humidity: number | undefined;
    let temperature: number | undefined;
    let pressure: number | undefined;
    let battery: number | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;

    // Si ChirpStack ya decodificó el payload mediante codec JavaScript
    if (msg.object) {
      humidity = this.parseNumber(msg.object.humidity ?? msg.object.soil_moisture ?? msg.object.hum);
      temperature = this.parseNumber(msg.object.temperature ?? msg.object.temp);
      pressure = this.parseNumber(msg.object.pressure ?? msg.object.barometer);
      battery = this.parseNumber(msg.object.battery ?? msg.object.batt ?? msg.object.battery_voltage);
      latitude = this.parseNumber(msg.object.latitude ?? msg.object.lat);
      longitude = this.parseNumber(msg.object.longitude ?? msg.object.lon ?? msg.object.lng);
    }

    // Si viene payload binario en Base64 y no hay objeto decodificado, decodificar buffer
    if ((humidity === undefined || temperature === undefined) && msg.data) {
      const decodedBuffer = this.decodeBinaryBuffer(Buffer.from(msg.data, 'base64'));
      humidity = humidity ?? decodedBuffer.humidity;
      temperature = temperature ?? decodedBuffer.temperature;
      battery = battery ?? decodedBuffer.battery;
    }

    return {
      devEui,
      timestamp: ts,
      humidity,
      temperature,
      pressure,
      battery,
      latitude,
      longitude,
      rssi: rxInfo.rssi,
      snr: rxInfo.snr,
      gatewayId: rxInfo.gatewayId,
      fCntUp: msg.fCnt,
      rawPayload: msg.data || JSON.stringify(msg.object),
    };
  }

  private decodeGenericJson(msg: any): NormalizedUplink {
    const devEui = (msg.devEUI || msg.devEui).toUpperCase();
    const ts = msg.timestamp || msg.time || new Date().toISOString();

    let humidity = this.parseNumber(msg.humidity ?? msg.soil_moisture ?? msg.hum);
    let temperature = this.parseNumber(msg.temperature ?? msg.temp);
    let pressure = this.parseNumber(msg.pressure);
    let battery = this.parseNumber(msg.battery ?? msg.batt);
    let latitude = this.parseNumber(msg.latitude ?? msg.lat);
    let longitude = this.parseNumber(msg.longitude ?? msg.lon ?? msg.lng);

    // Si viene rawPayload en base64
    if (msg.rawPayload && (humidity === undefined || temperature === undefined)) {
      const binDecoded = this.decodeBinaryBuffer(Buffer.from(msg.rawPayload, 'base64'));
      humidity = humidity ?? binDecoded.humidity;
      temperature = temperature ?? binDecoded.temperature;
      battery = battery ?? binDecoded.battery;
    }

    return {
      devEui,
      timestamp: ts,
      humidity,
      temperature,
      pressure,
      battery,
      latitude,
      longitude,
      rssi: msg.rssi,
      snr: msg.snr,
      gatewayId: msg.gatewayId || msg.gateway_id,
      fCntUp: msg.fCntUp || msg.fcnt_up,
      rawPayload: msg.rawPayload || (typeof msg === 'string' ? msg : JSON.stringify(msg)),
    };
  }

  /**
   * Decodificador binario compacto para sondas LoRaWAN:
   * Byte 0-1: Humedad (uint16 big-endian * 0.1)
   * Byte 2-3: Temperatura (int16 big-endian * 0.1)
   * Byte 4-5: Batería (uint16 big-endian * 0.001 V)
   */
  private decodeBinaryBuffer(buf: Buffer): { humidity?: number; temperature?: number; battery?: number } {
    if (buf.length < 4) return {};
    try {
      const rawHum = buf.readUInt16BE(0);
      const rawTemp = buf.readInt16BE(2);
      const humidity = +(rawHum * 0.1).toFixed(2);
      const temperature = +(rawTemp * 0.1).toFixed(2);
      let battery: number | undefined;

      if (buf.length >= 6) {
        battery = +(buf.readUInt16BE(4) * 0.001).toFixed(2);
      }

      return { humidity, temperature, battery };
    } catch {
      return {};
    }
  }

  private parseNumber(val: any): number | undefined {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }
}
