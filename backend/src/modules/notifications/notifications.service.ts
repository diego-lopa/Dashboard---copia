import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private mailTransporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    const smtp = this.configService.get('smtp');
    if (smtp && smtp.host) {
      this.mailTransporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.password,
        },
      });
    }
  }

  async dispatchNotification(alertEventId: string, rule: any, device: any, event: any) {
    const channels: string[] = Array.isArray(rule.channels) ? rule.channels : ['webhook'];

    for (const channel of channels) {
      if (channel === 'webhook') {
        await this.sendWebhook(alertEventId, rule, device, event);
      } else if (channel === 'email') {
        await this.sendEmail(alertEventId, rule, device, event);
      }
    }
  }

  private async sendWebhook(alertEventId: string, rule: any, device: any, event: any) {
    const webhookUrl = this.configService.get<string>('webhook.alertUrl');
    if (!webhookUrl) {
      this.logger.debug('Webhook URL no configurada, omitiendo notificación');
      return;
    }

    const payload = {
      event: 'alert_triggered',
      alertId: alertEventId,
      severity: event.severity,
      message: event.message,
      value: event.value,
      rule: {
        id: rule.id,
        name: rule.name,
        metric: rule.metric,
        threshold: rule.threshold,
      },
      device: {
        id: device.id,
        name: device.name,
        devEui: device.dev_eui,
        group: device.group_name,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      const resp = await axios.post(webhookUrl, payload, { timeout: 5000 });
      await this.logNotification(alertEventId, 'webhook', 'success', webhookUrl, `HTTP ${resp.status}`);
      this.logger.log(`Webhook enviado para evento ${alertEventId}`);
    } catch (err) {
      this.logger.error(`Error enviando webhook: ${err.message}`);
      await this.logNotification(alertEventId, 'webhook', 'failed', webhookUrl, err.message);
    }
  }

  private async sendEmail(alertEventId: string, rule: any, device: any, event: any) {
    if (!this.mailTransporter) {
      this.logger.debug('Servicio SMTP no configurado, omitiendo email');
      return;
    }

    const from = this.configService.get<string>('smtp.from');
    // Notificar a usuarios admin/operator del tenant
    const usersRes = await this.db.query(
      `SELECT email FROM users WHERE tenant_id = $1 AND role IN ('admin', 'operator') AND enabled = true`,
      [device.tenant_id],
    );

    const recipients = usersRes.rows.map((u) => u.email);
    if (recipients.length === 0) return;

    const subject = `[ALERTA ${event.severity.toUpperCase()}] ${device.name}: ${rule.name}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #e53e3e;">⚠️ Alerta Detectada en Plataforma IoT</h2>
        <p><strong>Dispositivo:</strong> ${device.name} (<code>${device.dev_eui}</code>)</p>
        <p><strong>Regla:</strong> ${rule.name}</p>
        <p><strong>Valor detectado:</strong> ${event.value}</p>
        <p><strong>Mensaje:</strong> ${event.message}</p>
        <p><strong>Severidad:</strong> ${event.severity.toUpperCase()}</p>
        <p><strong>Fecha/Hora (UTC):</strong> ${new Date().toISOString()}</p>
      </div>
    `;

    try {
      await this.mailTransporter.sendMail({
        from,
        to: recipients,
        subject,
        html: htmlBody,
      });
      await this.logNotification(alertEventId, 'email', 'success', recipients.join(', '), 'Email enviado');
      this.logger.log(`Emails de alerta enviados a ${recipients.join(', ')}`);
    } catch (err) {
      this.logger.error(`Error enviando email de alerta: ${err.message}`);
      await this.logNotification(alertEventId, 'email', 'failed', recipients.join(', '), err.message);
    }
  }

  private async logNotification(
    alertEventId: string,
    channel: string,
    status: string,
    recipient: string,
    response: string,
  ) {
    await this.db.query(
      `INSERT INTO notification_logs (alert_event_id, channel, status, recipient, response)
       VALUES ($1, $2, $3, $4, $5)`,
      [alertEventId, channel, status, recipient, response],
    );
  }
}
