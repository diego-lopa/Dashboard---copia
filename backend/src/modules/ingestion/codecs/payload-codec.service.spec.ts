import { Test, TestingModule } from '@nestjs/testing';
import { PayloadCodecService } from './payload-codec.service';

describe('PayloadCodecService', () => {
  let service: PayloadCodecService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayloadCodecService],
    }).compile();

    service = module.get<PayloadCodecService>(PayloadCodecService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe decodificar un evento ChirpStack v4 JSON con objeto decodificado', () => {
    const mockChirpstackMsg = {
      deviceInfo: {
        devEui: '0011223344556601',
        deviceName: 'Sensor Humedad A1',
      },
      time: '2026-02-16T10:20:00Z',
      fCnt: 124,
      rxInfo: [
        {
          gatewayId: 'AABBCCDDEEFF0011',
          rssi: -98,
          snr: 8.5,
        },
      ],
      object: {
        humidity: 43.5,
        temperature: 22.1,
        battery: 3.75,
        pressure: 1012.4,
      },
    };

    const result = service.decode(mockChirpstackMsg);
    expect(result).toBeDefined();
    expect(result.devEui).toBe('0011223344556601');
    expect(result.humidity).toBe(43.5);
    expect(result.temperature).toBe(22.1);
    expect(result.battery).toBe(3.75);
    expect(result.rssi).toBe(-98);
    expect(result.snr).toBe(8.5);
  });

  it('debe decodificar un buffer binario base64 cuando no hay objeto decodificado', () => {
    // Buffer binario: Humedad 55.0% (550 -> 0x0226), Temp 24.5°C (245 -> 0x00F5), Batt 3.80V (3800 -> 0x0ED8)
    const buf = Buffer.alloc(6);
    buf.writeUInt16BE(550, 0);
    buf.writeInt16BE(245, 2);
    buf.writeUInt16BE(3800, 4);

    const mockMsg = {
      devEui: '0011223344556602',
      rawPayload: buf.toString('base64'),
    };

    const result = service.decode(mockMsg);
    expect(result).toBeDefined();
    expect(result.devEui).toBe('0011223344556602');
    expect(result.humidity).toBe(55.0);
    expect(result.temperature).toBe(24.5);
    expect(result.battery).toBe(3.8);
  });
});
