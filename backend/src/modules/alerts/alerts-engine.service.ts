import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NormalizedUplink } from '../../shared/types';

@Injectable()
export class AlertsEngineService {
  private readonly logger = new Logger(AlertsEngineService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Evalúa las reglas de alerta aplicables a una nueva medición de sensor
   */
  async evaluateUplink(device: any, uplink: NormalizedUplink) {
    try {
      // 1. Obtener reglas globales del tenant o específicas del dispositivo
      const rulesRes = await this.db.query(
        `SELECT * FROM alert_rules 
         WHERE tenant_id = $1 AND enabled = true 
           AND (device_id IS NULL OR device_id = $2)`,
        [device.tenant_id, device.id],
      );

      const rules = rulesRes.rows;
      if (rules.length === 0) return;

      for (const rule of rules) {
        await this.evaluateRule(rule, device, uplink);
      }
    } catch (err) {
      this.logger.error(`Error evaluando reglas de alerta para ${device.dev_eui}: ${err.message}`);
    }
  }

  private async evaluateRule(rule: any, device: any, uplink: NormalizedUplink) {
    const value = this.extractMetricValue(rule.metric, uplink);
    if (value === undefined || value === null || isNaN(value)) return;

    // Buscar si ya existe una alerta activa para este rule_id y device_id
    const activeEventRes = await this.db.query(
      `SELECT * FROM alert_events 
       WHERE rule_id = $1 AND device_id = $2 AND state IN ('triggered', 'acknowledged')
       ORDER BY triggered_at DESC LIMIT 1`,
      [rule.id, device.id],
    );

    const activeEvent = activeEventRes.rows[0];
    const isConditionMet = this.checkCondition(value, rule.condition, rule.threshold);

    if (isConditionMet) {
      // Si la condición se cumple y NO hay alerta activa -> Disparar nueva alerta
      if (!activeEvent) {
        await this.triggerAlert(rule, device, value);
      }
    } else {
      // Si la condición NO se cumple y SÍ hay alerta activa -> Comprobar histéresis antes de resolver
      if (activeEvent) {
        const canResolve = this.checkHysteresisResolution(value, rule.condition, rule.threshold, rule.hysteresis);
        if (canResolve) {
          await this.resolveAlert(activeEvent, device, rule, value);
        }
      }
    }
  }

  private extractMetricValue(metric: string, uplink: NormalizedUplink): number | null {
    switch (metric.toLowerCase()) {
      case 'humidity':
        return uplink.humidity ?? null;
      case 'temperature':
        return uplink.temperature ?? null;
      case 'battery':
        return uplink.battery ?? null;
      case 'rssi':
        return uplink.rssi ?? null;
      case 'snr':
        return uplink.snr ?? null;
      default:
        return null;
    }
  }

  private checkCondition(val: number, cond: string, threshold: number): boolean {
    switch (cond) {
      case '>':
        return val > threshold;
      case '>=':
        return val >= threshold;
      case '<':
        return val < threshold;
      case '<=':
        return val <= threshold;
      case '==':
        return val === threshold;
      case '!=':
        return val !== threshold;
      default:
        return false;
    }
  }

  /**
   * Determina si el valor ha salido de la zona de histéresis para resolver la alerta sin flapping
   */
  private checkHysteresisResolution(val: number, cond: string, threshold: number, hysteresis: number): boolean {
    const hyst = hysteresis || 0;
    if (cond === '>' || cond === '>=') {
      // Si se disparó por valor alto (ej: >= 80, hyst: 3), solo se resuelve si baja de 77
      return val < threshold - hyst;
    } else if (cond === '<' || cond === '<=') {
      // Si se disparó por valor bajo (ej: <= 30, hyst: 3), solo se resuelve si sube de 33
      return val > threshold + hyst;
    }
    return true;
  }

  private async triggerAlert(rule: any, device: any, value: number) {
    const message = `Alerta ${rule.name}: ${rule.metric} ${rule.condition} ${rule.threshold} (Valor detectado: ${value})`;
    this.logger.warn(`🚨 DISPARANDO ALERTA: ${device.name} -> ${message}`);

    const res = await this.db.query(
      `INSERT INTO alert_events (rule_id, device_id, state, severity, value, message, triggered_at)
       VALUES ($1, $2, 'triggered', $3, $4, $5, now())
       RETURNING *`,
      [rule.id, device.id, rule.severity, value, message],
    );

    const newEvent = res.rows[0];

    // 1. Notificar en tiempo real al frontend
    this.realtime.broadcastAlert(device.id, {
      id: newEvent.id,
      ruleId: rule.id,
      ruleName: rule.name,
      deviceName: device.name,
      devEui: device.dev_eui,
      state: 'triggered',
      severity: rule.severity,
      value,
      message,
      triggeredAt: newEvent.triggered_at,
    });

    // 2. Disparar notificaciones externas (Webhook / Email)
    await this.notifications.dispatchNotification(newEvent.id, rule, device, newEvent);
  }

  private async resolveAlert(activeEvent: any, device: any, rule: any, currentValue: number) {
    this.logger.log(`✅ ALERTA RESUELTA (Histéresis satisfecha): ${device.name} -> ${rule.name} (Valor actual: ${currentValue})`);

    const res = await this.db.query(
      `UPDATE alert_events 
       SET state = 'resolved', resolved_at = now() 
       WHERE id = $1 
       RETURNING *`,
      [activeEvent.id],
    );

    const resolvedEvent = res.rows[0];

    this.realtime.broadcastAlert(device.id, {
      id: resolvedEvent.id,
      ruleId: rule.id,
      ruleName: rule.name,
      deviceName: device.name,
      devEui: device.dev_eui,
      state: 'resolved',
      severity: rule.severity,
      value: currentValue,
      message: `Resuelta: ${rule.name}`,
      resolvedAt: resolvedEvent.resolved_at,
    });
  }

  /**
   * Monitor periódico para detectar sensores desconectados (Offline Watchdog)
   */
  async checkOfflineDevices() {
    try {
      const offlineThresholdMinutes = 15;
      const res = await this.db.query(`
        SELECT d.id, d.tenant_id, d.name, d.dev_eui, d.group_name, d.last_seen_at
        FROM devices d
        WHERE d.enabled = true 
          AND (d.last_seen_at IS NULL OR d.last_seen_at < (now() - interval '${offlineThresholdMinutes} minutes'))
      `);

      for (const dev of res.rows) {
        this.realtime.broadcastDeviceStatus(
          dev.id,
          'offline',
          dev.last_seen_at ? new Date(dev.last_seen_at).toISOString() : 'Nunca',
        );
      }
    } catch (err) {
      this.logger.error(`Error en Offline Devices Watchdog: ${err.message}`);
    }
  }
}
