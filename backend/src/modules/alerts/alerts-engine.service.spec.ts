import { Test, TestingModule } from '@nestjs/testing';
import { AlertsEngineService } from './alerts-engine.service';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AlertsEngineService (Hysteresis & Rules)', () => {
  let service: AlertsEngineService;

  const mockDb = {
    query: jest.fn(),
  };
  const mockRealtime = {
    broadcastAlert: jest.fn(),
    broadcastDeviceStatus: jest.fn(),
  };
  const mockNotifications = {
    dispatchNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsEngineService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AlertsEngineService>(AlertsEngineService);
    jest.clearAllMocks();
  });

  it('debe disparar alerta cuando el valor supera el umbral alto y no hay alerta activa previa', async () => {
    const mockDevice = { id: 'dev-1', tenant_id: 'tenant-1', name: 'Sensor 1', dev_eui: '0011223344556601' };
    const mockRule = {
      id: 'rule-1',
      name: 'Humedad Alta',
      metric: 'humidity',
      condition: '>=',
      threshold: 80.0,
      hysteresis: 3.0,
      severity: 'warning',
    };

    // 1. mock select rules
    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM alert_rules')) {
        return Promise.resolve({ rows: [mockRule] });
      }
      if (sql.includes('SELECT * FROM alert_events')) {
        return Promise.resolve({ rows: [] }); // Sin alerta activa previa
      }
      if (sql.includes('INSERT INTO alert_events')) {
        return Promise.resolve({ rows: [{ id: 'event-1', triggered_at: new Date() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await service.evaluateUplink(mockDevice, { devEui: '0011223344556601', humidity: 84.5 });

    expect(mockRealtime.broadcastAlert).toHaveBeenCalledWith(
      'dev-1',
      expect.objectContaining({ state: 'triggered', value: 84.5 }),
    );
    expect(mockNotifications.dispatchNotification).toHaveBeenCalled();
  });

  it('no debe resolver alerta si el valor baja pero aún se encuentra dentro de la banda de histéresis', async () => {
    const mockDevice = { id: 'dev-1', tenant_id: 'tenant-1', name: 'Sensor 1', dev_eui: '0011223344556601' };
    const mockRule = {
      id: 'rule-1',
      name: 'Humedad Alta',
      metric: 'humidity',
      condition: '>=',
      threshold: 80.0,
      hysteresis: 3.0, // Solo se resuelve con < 77.0
      severity: 'warning',
    };
    const activeEvent = { id: 'event-1', state: 'triggered' };

    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM alert_rules')) {
        return Promise.resolve({ rows: [mockRule] });
      }
      if (sql.includes('SELECT * FROM alert_events')) {
        return Promise.resolve({ rows: [activeEvent] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Valor 78.5 (menor que 80 pero mayor que 77 -> En histéresis)
    await service.evaluateUplink(mockDevice, { devEui: '0011223344556601', humidity: 78.5 });

    expect(mockDb.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE alert_events'), expect.anything());
    expect(mockRealtime.broadcastAlert).not.toHaveBeenCalled();
  });

  it('debe resolver la alerta cuando el valor cae por debajo del umbral menos la histéresis (< 77.0)', async () => {
    const mockDevice = { id: 'dev-1', tenant_id: 'tenant-1', name: 'Sensor 1', dev_eui: '0011223344556601' };
    const mockRule = {
      id: 'rule-1',
      name: 'Humedad Alta',
      metric: 'humidity',
      condition: '>=',
      threshold: 80.0,
      hysteresis: 3.0,
      severity: 'warning',
    };
    const activeEvent = { id: 'event-1', state: 'triggered' };

    mockDb.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM alert_rules')) {
        return Promise.resolve({ rows: [mockRule] });
      }
      if (sql.includes('SELECT * FROM alert_events')) {
        return Promise.resolve({ rows: [activeEvent] });
      }
      if (sql.includes('UPDATE alert_events')) {
        return Promise.resolve({ rows: [{ id: 'event-1', state: 'resolved', resolved_at: new Date() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Valor 75.0 (menor que 77.0 -> Histéresis satisfecha, se resuelve)
    await service.evaluateUplink(mockDevice, { devEui: '0011223344556601', humidity: 75.0 });

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE alert_events'),
      ['event-1'],
    );
    expect(mockRealtime.broadcastAlert).toHaveBeenCalledWith(
      'dev-1',
      expect.objectContaining({ state: 'resolved', value: 75.0 }),
    );
  });
});
