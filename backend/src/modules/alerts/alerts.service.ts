import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/create-alert-rule.dto';

@Injectable()
export class AlertsService {
  constructor(private readonly db: DatabaseService) {}

  async findAllRules(tenantId: string) {
    const res = await this.db.query(
      `SELECT ar.*, d.name as device_name, d.dev_eui
       FROM alert_rules ar
       LEFT JOIN devices d ON d.id = ar.device_id
       WHERE ar.tenant_id = $1
       ORDER BY ar.created_at DESC`,
      [tenantId],
    );
    return res.rows;
  }

  async findOneRule(id: string, tenantId: string) {
    const res = await this.db.query(
      `SELECT ar.*, d.name as device_name, d.dev_eui
       FROM alert_rules ar
       LEFT JOIN devices d ON d.id = ar.device_id
       WHERE ar.id = $1 AND ar.tenant_id = $2`,
      [id, tenantId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException('Regla de alerta no encontrada');
    }
    return res.rows[0];
  }

  async createRule(tenantId: string, dto: CreateAlertRuleDto) {
    const channels = dto.channels ? JSON.stringify(dto.channels) : '["webhook", "email"]';
    const res = await this.db.query(
      `INSERT INTO alert_rules (
        tenant_id, device_id, name, metric, condition, threshold, duration_seconds, hysteresis, severity, enabled, channels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING *`,
      [
        tenantId,
        dto.deviceId || null,
        dto.name.trim(),
        dto.metric,
        dto.condition,
        dto.threshold,
        dto.durationSeconds || 0,
        dto.hysteresis || 0,
        dto.severity || 'warning',
        dto.enabled !== undefined ? dto.enabled : true,
        channels,
      ],
    );
    return res.rows[0];
  }

  async updateRule(id: string, tenantId: string, dto: UpdateAlertRuleDto) {
    await this.findOneRule(id, tenantId);

    const fields: string[] = ['updated_at = now()'];
    const values: any[] = [id, tenantId];
    let idx = 3;

    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }
    if (dto.threshold !== undefined) {
      fields.push(`threshold = $${idx++}`);
      values.push(dto.threshold);
    }
    if (dto.durationSeconds !== undefined) {
      fields.push(`duration_seconds = $${idx++}`);
      values.push(dto.durationSeconds);
    }
    if (dto.hysteresis !== undefined) {
      fields.push(`hysteresis = $${idx++}`);
      values.push(dto.hysteresis);
    }
    if (dto.severity !== undefined) {
      fields.push(`severity = $${idx++}`);
      values.push(dto.severity);
    }
    if (dto.enabled !== undefined) {
      fields.push(`enabled = $${idx++}`);
      values.push(dto.enabled);
    }
    if (dto.channels !== undefined) {
      fields.push(`channels = $${idx++}::jsonb`);
      values.push(JSON.stringify(dto.channels));
    }

    const res = await this.db.query(
      `UPDATE alert_rules SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      values,
    );
    return res.rows[0];
  }

  async deleteRule(id: string, tenantId: string) {
    await this.findOneRule(id, tenantId);
    await this.db.query('DELETE FROM alert_rules WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return { success: true, message: 'Regla de alerta eliminada' };
  }

  async findAllEvents(tenantId: string, limit = 100) {
    const res = await this.db.query(
      `SELECT 
        ae.*,
        ar.name as rule_name,
        ar.metric,
        ar.condition,
        ar.threshold,
        d.name as device_name,
        d.dev_eui,
        u.email as acknowledged_by_email
       FROM alert_events ae
       JOIN alert_rules ar ON ar.id = ae.rule_id
       JOIN devices d ON d.id = ae.device_id
       LEFT JOIN users u ON u.id = ae.acknowledged_by
       WHERE d.tenant_id = $1
       ORDER BY ae.triggered_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return res.rows;
  }

  async acknowledgeEvent(id: string, tenantId: string, userId: string) {
    const res = await this.db.query(
      `UPDATE alert_events ae
       SET state = 'acknowledged', 
           acknowledged_at = now(),
           acknowledged_by = $1
       FROM devices d
       WHERE ae.id = $2 AND ae.device_id = d.id AND d.tenant_id = $3 AND ae.state = 'triggered'
       RETURNING ae.*`,
      [userId, id, tenantId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Evento de alerta no encontrado o ya reconocido');
    }

    return res.rows[0];
  }
}
