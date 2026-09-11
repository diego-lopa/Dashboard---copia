import { Injectable, Logger } from '@nestjs/common';
import { NormalizedUplink } from '../../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PayloadCodecService {
  private readonly logger = new Logger(PayloadCodecService.name);

  /**
   * Carga dinámica de la calibración CRNS desde
   * cornea_pipeline/config/calibration_config.json (montado en Docker como
   * /cornea_pipeline/config/calibration_config.json). Si no se encuentra,
   * usa los valores maestros del JSON como fallback.
   */
  private getCalibrationConfig(): any {
    try {
      const possiblePaths = [
        '/cornea_pipeline/config/calibration_config.json',
        path.resolve(process.cwd(), '../cornea_pipeline/config/calibration_config.json'),
        path.resolve(process.cwd(), '../../cornea_pipeline/config/calibration_config.json'),
        path.resolve(process.cwd(), './cornea_pipeline/config/calibration_config.json'),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          return JSON.parse(raw);
        }
      }
    } catch (err) {
      this.logger.warn(`No se pudo leer calibration_config.json dinámicamente: ${err.message}`);
    }

    // Fallback = valores maestros del calibration_config.json (Geant4, R²=0.9687)
    return {
      N0_suelo_seco: 143.0,
      modelo_ajuste: 'exponential',
      parametros: {
        a0: 107.38107297640175,
        a1: 3.0361746292354415,
        a2: -4.894223415942227,
      },
      presion_referencia_P0: 981.4,
      longitud_atenuacion_L: 137.0,
    };
  }

  /**
   * Convierte recuento bruto de neutrones a % de humedad volumétrica:
   *   1. fp = exp((P0 - P) / L) ; N_corr = N_raw * fp
   *   2. ratio = N_corr / N0
   *   3. θ(%) = a0 * e^(-a1 * ratio) + a2   (modelo Geant4 calibrado)
   */
  public calculateMoistureFromNeutrons(nRaw: number, pressureHpa: number = 981.4): number {
    const cfg = this.getCalibrationConfig();
    const N0 = cfg.N0_suelo_seco ?? 143.0;
    const modelo = cfg.modelo_ajuste ?? 'exponential';
    const params = cfg.parametros ?? {};
    const P0 = cfg.presion_referencia_P0 ?? 981.4;
    const L = cfg.longitud_atenuacion_L ?? 137.0;

    // 1. Corrección barométrica
    const fPresion = Math.exp((P0 - pressureHpa) / L);
    const nCorr = nRaw * fPresion;

    // 2. Ratio adimensional
    const ratio = N0 > 0 ? nCorr / N0 : 1.0;

    // 3. Ecuación de calibración
    let theta = 0;
    const a0 = params.a0 ?? 107.38107297640175;
    const a1 = params.a1 ?? 3.0361746292354415;
    const a2 = params.a2 ?? -4.894223415942227;

    if (modelo === 'exponential') {
      theta = a0 * Math.exp(-a1 * ratio) + a2;
    } else if (modelo === 'hyperbolic' || modelo === 'desilets') {
      const denom = Math.abs(ratio - a1) < 1e-6 ? 1e-6 : ratio - a1;
      theta = a0 / denom - a2;
    } else if (modelo === 'quadratic') {
      theta = a0 + a1 * ratio + a2 * Math.pow(ratio, 2);
    } else {
      theta = a0 * Math.exp(-a1 * ratio) + a2;
    }

    return Math.max(0.0, Math.min(100.0, +theta.toFixed(2)));
  }

  /**
   * Estima N_raw a partir de una humedad conocida (inversa del modelo).
   * Se usa cuando el uplink trae humedad pero no neutrones, para que todos
   * los registros tengan todos los tipos de datos (coherencia de gráficas).
   * Es una estimación (no medida): N = ratio·N0/fp con
   * ratio = -ln((θ-a2)/a0)/a1.
   */
  public estimateNeutronsFromHumidity(humidity: number, pressureHpa: number = 981.4): number {
    const cfg = this.getCalibrationConfig();
    const N0 = cfg.N0_suelo_seco ?? 143.0;
    const params = cfg.parametros ?? {};
    const P0 = cfg.presion_referencia_P0 ?? 981.4;
    const L = cfg.longitud_atenuacion_L ?? 137.0;
    const a0 = params.a0 ?? 107.38107297640175;
    const a1 = params.a1 ?? 3.0361746292354415;
    const a2 = params.a2 ?? -4.894223415942227;

    const t = Math.min(99, Math.max(0.5, humidity));
    const x = (t - a2) / a0;
    if (x <= 0 || a1 === 0) return Math.round(N0);
    const ratio = -Math.log(x) / a1;
    const fp = Math.exp((P0 - pressureHpa) / L);
    if (fp <= 0) return Math.round(N0);
    return Math.max(1, Math.round(((ratio * N0) / fp) * 10) / 10);
  }

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
    let rawNeutrons: number | undefined;
    if (msg.object) {
      temperature = this.parseNumber(msg.object.temperature ?? msg.object.temp);
      pressure = this.parseNumber(msg.object.pressure ?? msg.object.barometer);
      battery = this.parseNumber(msg.object.battery ?? msg.object.batt ?? msg.object.battery_voltage);
      latitude = this.parseNumber(msg.object.latitude ?? msg.object.lat);
      longitude = this.parseNumber(msg.object.longitude ?? msg.object.lon ?? msg.object.lng);

      // Si vienen neutrones CRNS (neutron_counts / neutrons / n_raw),
      // la humedad se calcula con el modelo Geant4 calibrado
      rawNeutrons = this.parseNumber(
        msg.object.neutron_counts ?? msg.object.neutrons ?? msg.object.n_raw ?? msg.object.neutron_count,
      );
      if (rawNeutrons !== undefined) {
        humidity = this.calculateMoistureFromNeutrons(rawNeutrons, pressure ?? 981.4);
      } else {
        humidity = this.parseNumber(msg.object.humidity ?? msg.object.soil_moisture ?? msg.object.hum);
        // Sin neutrones pero con humedad: estimar N para coherencia total
        if (humidity !== undefined) {
          rawNeutrons = this.estimateNeutronsFromHumidity(humidity, pressure ?? 981.4);
        }
      }
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
      neutron_counts: rawNeutrons,
    };
  }

  private decodeGenericJson(msg: any): NormalizedUplink {
    const devEui = (msg.devEUI || msg.devEui).toUpperCase();
    const ts = msg.timestamp || msg.time || new Date().toISOString();

    let temperature = this.parseNumber(msg.temperature ?? msg.temp);
    let pressure = this.parseNumber(msg.pressure);
    let battery = this.parseNumber(msg.battery ?? msg.batt);
    let latitude = this.parseNumber(msg.latitude ?? msg.lat);
    let longitude = this.parseNumber(msg.longitude ?? msg.lon ?? msg.lng);

    // Si vienen neutrones CRNS, la humedad se calcula con el modelo Geant4.
    // Si solo viene humedad, se estima N para coherencia total de registros.
    let rawNeutrons = this.parseNumber(msg.neutron_counts ?? msg.neutrons ?? msg.n_raw ?? msg.neutron_count);
    let humidity: number | undefined;
    if (rawNeutrons !== undefined) {
      humidity = this.calculateMoistureFromNeutrons(rawNeutrons, pressure ?? 981.4);
    } else {
      humidity = this.parseNumber(msg.humidity ?? msg.soil_moisture ?? msg.hum);
      if (humidity !== undefined) {
        rawNeutrons = this.estimateNeutronsFromHumidity(humidity, pressure ?? 981.4);
      }
    }

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
      neutron_counts: rawNeutrons,
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
